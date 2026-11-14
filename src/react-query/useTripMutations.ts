import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { createTripApi, updateTripApi, deleteTripApi } from './api';
import { tripQueryKeys } from './queryClient';
import type { Trip, TripListResponse } from './types';

/**
 * Mutation hook for creating a new expedition.
 * Invalidates ['trips'] on success to refresh lists and counts across the app.
 */
export function useCreateTrip(): UseMutationResult<Trip, Error, FormData> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (formData: FormData) => createTripApi(formData),
    onSuccess: () => {
      // Invalidate all trips queries (lists, counts, filter combinations)
      queryClient.invalidateQueries({ queryKey: tripQueryKeys.all });
    },
  });
}

export interface UpdateTripVariables {
  id: string;
  formData: FormData;
  patch?: Partial<Trip>;
}

interface UpdateTripContext {
  previousTrip?: Trip;
  previousLists?: [readonly unknown[], TripListResponse | undefined][];
}

/**
 * Mutation hook for updating an expedition with Optimistic Updates:
 * - Cancels active in-flight refetches for ['trips']
 * - Snapshots current cache state
 * - Optimistically applies patch to detail and matching list caches
 * - Rolls back snapshots on error
 * - Invalidates queries on settlement to ensure canonical backend sync
 */
export function useUpdateTrip(): UseMutationResult<
  Trip,
  Error,
  UpdateTripVariables,
  UpdateTripContext
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, formData }: UpdateTripVariables) => updateTripApi(id, formData),
    onMutate: async ({ id, patch }) => {
      // 1. Cancel any outgoing refetches so they don't overwrite optimistic updates
      await queryClient.cancelQueries({ queryKey: tripQueryKeys.all });

      // 2. Snapshot previous trip detail
      const previousTrip = queryClient.getQueryData<Trip>(tripQueryKeys.detail(id));

      // 3. Optimistically update trip detail if patch provided
      if (patch && previousTrip) {
        queryClient.setQueryData<Trip>(tripQueryKeys.detail(id), {
          ...previousTrip,
          ...patch,
        });
      }

      // 4. Snapshot and optimistically update matching list queries
      const previousLists = queryClient.getQueriesData<TripListResponse>({
        queryKey: tripQueryKeys.all,
      });

      if (patch) {
        previousLists.forEach(([key, oldData]) => {
          if (!oldData?.trips) return;
          queryClient.setQueryData<TripListResponse>(key, {
            ...oldData,
            trips: oldData.trips.map((t) => (t._id === id ? { ...t, ...patch } : t)),
          });
        });
      }

      return { previousTrip, previousLists };
    },
    onError: (_err, { id }, context) => {
      // Rollback detail
      if (context?.previousTrip) {
        queryClient.setQueryData(tripQueryKeys.detail(id), context.previousTrip);
      }
      // Rollback list queries
      if (context?.previousLists) {
        context.previousLists.forEach(([key, oldData]) => {
          queryClient.setQueryData(key, oldData);
        });
      }
    },
    onSettled: (_data, _err, { id }) => {
      // Always invalidate detail and list queries after error or success
      queryClient.invalidateQueries({ queryKey: tripQueryKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: tripQueryKeys.all });
    },
  });
}

interface DeleteTripContext {
  previousLists?: [readonly unknown[], TripListResponse | undefined][];
}

/**
 * Mutation hook for deleting an expedition with Optimistic Updates:
 * - Optimistically removes the trip from all active list queries
 * - Decrements total count
 * - Rolls back on error
 * - Invalidates queries on settlement
 */
export function useDeleteTrip(): UseMutationResult<
  null,
  Error,
  string,
  DeleteTripContext
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteTripApi(id),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: tripQueryKeys.all });

      const previousLists = queryClient.getQueriesData<TripListResponse>({
        queryKey: tripQueryKeys.all,
      });

      // Optimistically remove from list caches
      previousLists.forEach(([key, oldData]) => {
        if (!oldData?.trips) return;
        queryClient.setQueryData<TripListResponse>(key, {
          ...oldData,
          trips: oldData.trips.filter((t) => t._id !== id),
          pagination: {
            ...oldData.pagination,
            total: Math.max(0, oldData.pagination.total - 1),
          },
        });
      });

      return { previousLists };
    },
    onError: (_err, _id, context) => {
      if (context?.previousLists) {
        context.previousLists.forEach(([key, oldData]) => {
          queryClient.setQueryData(key, oldData);
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: tripQueryKeys.all });
    },
  });
}
