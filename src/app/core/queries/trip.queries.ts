import { inject, Signal } from '@angular/core';
import {
  injectQuery,
  injectMutation,
  injectQueryClient,
  CreateQueryResult,
  CreateMutationResult,
} from '@tanstack/angular-query-experimental';
import { firstValueFrom } from 'rxjs';
import { TripService } from '../services/trip.service';
import {
  Trip,
  TripQueryParams,
  TripListResponse,
} from '../models/trip.model';

/**
 * Normalized query keys for trip features.
 * Hierarchical structure ensures queryClient.invalidateQueries({ queryKey: ['trips'] })
 * invalidates all lists, filter permutations, and details when mutations occur.
 */
export const tripQueryKeys = {
  all: ['trips'] as const,
  list: (params?: TripQueryParams) => {
    // Sanitize params to avoid undefined key differences
    const sanitized = {
      location: params?.location?.trim() || undefined,
      minPrice: params?.minPrice !== undefined && params?.minPrice !== null ? Number(params.minPrice) : undefined,
      maxPrice: params?.maxPrice !== undefined && params?.maxPrice !== null ? Number(params.maxPrice) : undefined,
      sortBy: params?.sortBy || 'createdAt',
      order: params?.order || 'desc',
      page: params?.page || 1,
      limit: params?.limit || 9,
    };
    return ['trips', sanitized] as const;
  },
  detail: (id: string) => ['trips', 'detail', id] as const,
  myTrips: (params?: { page?: number; limit?: number }) => ['trips', 'my-trips', params ?? {}] as const,
};

/**
 * Custom query function for fetching the trips list with filters, sorting, and pagination.
 * Wraps TanStack Query injectQuery for Angular.
 * Redundant calls are prevented via global staleTime (5 mins).
 */
export function injectTripsQuery(
  paramsAccessor: () => TripQueryParams
): CreateQueryResult<TripListResponse, Error> {
  const tripService = inject(TripService);

  return injectQuery(() => {
    const params = paramsAccessor();
    return {
      queryKey: tripQueryKeys.list(params),
      queryFn: async ({ signal }): Promise<TripListResponse> => {
        const res = await firstValueFrom(tripService.getAllTrips(params));
        return res.data;
      },
    };
  });
}

/**
 * Custom query function for fetching the organizer's own trips.
 * Cached with global 5min staleTime, shared across navigation, and auto-invalidated on mutations.
 */
export function injectMyTripsQuery(
  paramsAccessor?: () => { page?: number; limit?: number }
): CreateQueryResult<TripListResponse, Error> {
  const tripService = inject(TripService);

  return injectQuery(() => {
    const params = paramsAccessor ? paramsAccessor() : undefined;
    return {
      queryKey: tripQueryKeys.myTrips(params),
      queryFn: async (): Promise<TripListResponse> => {
        const res = await firstValueFrom(tripService.getMyTrips(params));
        return res.data;
      },
    };
  });
}

/**
 * Custom query function for fetching single trip details by ID.
 */
export function injectTripDetailQuery(
  idAccessor: () => string | null | undefined
): CreateQueryResult<Trip, Error> {
  const tripService = inject(TripService);

  return injectQuery(() => {
    const id = idAccessor();
    return {
      queryKey: id ? tripQueryKeys.detail(id) : ['trips', 'detail', 'none'],
      enabled: !!id,
      queryFn: async (): Promise<Trip> => {
        if (!id) throw new Error('Trip ID is required');
        const res = await firstValueFrom(tripService.getTripById(id));
        return res.data.trip;
      },
    };
  });
}

/**
 * Mutation for creating a new expedition.
 * Invalidates the entire ['trips'] cache on success to ensure the list refreshes seamlessly.
 */
export function injectCreateTripMutation() {
  const tripService = inject(TripService);
  const queryClient = injectQueryClient();

  return injectMutation(() => ({
    mutationFn: async (formData: FormData): Promise<Trip> => {
      const res = await firstValueFrom(tripService.createTrip(formData));
      return res.data.trip;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tripQueryKeys.all });
    },
  }));
}

/**
 * Mutation for updating an existing expedition with optimistic update support.
 */
export function injectUpdateTripMutation() {
  const tripService = inject(TripService);
  const queryClient = injectQueryClient();

  return injectMutation(() => ({
    mutationFn: async ({ id, formData }: { id: string; formData: FormData; patch?: Partial<Trip> }): Promise<Trip> => {
      const res = await firstValueFrom(tripService.updateTrip(id, formData));
      return res.data.trip;
    },
    onMutate: async ({ id, patch }) => {
      // Cancel outgoing refetches so they don't overwrite optimistic update
      await queryClient.cancelQueries({ queryKey: tripQueryKeys.all });

      // Snapshot detail cache
      const previousTrip = queryClient.getQueryData<Trip>(tripQueryKeys.detail(id));

      // Optimistically update detail if patch is provided
      if (patch && previousTrip) {
        queryClient.setQueryData<Trip>(tripQueryKeys.detail(id), {
          ...previousTrip,
          ...patch,
        });
      }

      // Snapshot and optimistically update matching list queries
      const matchingQueries = queryClient.getQueriesData<TripListResponse>({
        queryKey: tripQueryKeys.all,
      });

      if (patch) {
        matchingQueries.forEach(([key, oldData]) => {
          if (!oldData?.trips) return;
          queryClient.setQueryData<TripListResponse>(key, {
            ...oldData,
            trips: oldData.trips.map(t => (t._id === id ? { ...t, ...patch } : t)),
          });
        });
      }

      return { previousTrip, previousList: matchingQueries };
    },
    onError: (_err, { id }, context) => {
      // Roll back detail
      if (context?.previousTrip) {
        queryClient.setQueryData(tripQueryKeys.detail(id), context.previousTrip);
      }
      // Roll back lists
      if (context?.previousList) {
        context.previousList.forEach(([key, data]) => {
          queryClient.setQueryData(key, data);
        });
      }
    },
    onSettled: (_data, _err, { id }) => {
      // Always invalidate to ensure server state consistency
      queryClient.invalidateQueries({ queryKey: tripQueryKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: tripQueryKeys.all });
    },
  }));
}

/**
 * Mutation for deleting a trip.
 * Optimistically removes from cache and invalidates queryKey: ['trips'].
 */
export function injectDeleteTripMutation() {
  const tripService = inject(TripService);
  const queryClient = injectQueryClient();

  return injectMutation(() => ({
    mutationFn: async (id: string): Promise<null> => {
      await firstValueFrom(tripService.deleteTrip(id));
      return null;
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: tripQueryKeys.all });

      const previousList = queryClient.getQueriesData<TripListResponse>({
        queryKey: tripQueryKeys.all,
      });

      // Optimistically remove from list caches
      previousList.forEach(([key, oldData]) => {
        if (!oldData?.trips) return;
        queryClient.setQueryData<TripListResponse>(key, {
          ...oldData,
          trips: oldData.trips.filter(t => t._id !== id),
          pagination: {
            ...oldData.pagination,
            total: Math.max(0, oldData.pagination.total - 1),
          },
        });
      });

      return { previousList };
    },
    onError: (_err, _id, context) => {
      if (context?.previousList) {
        context.previousList.forEach(([key, data]) => {
          queryClient.setQueryData(key, data);
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: tripQueryKeys.all });
    },
  }));
}
