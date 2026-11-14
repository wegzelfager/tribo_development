import { QueryClient } from '@tanstack/query-core';
import type { TripQueryParams } from './types';

/**
 * Global QueryClient instance configured with optimized defaults:
 *
 * 1. staleTime: 5 minutes (5 * 60 * 1000)
 *    Data fetched once remains fresh and will NOT trigger background refetches
 *    on simple component remounts or back-and-forth page navigation.
 *
 * 2. gcTime: 10 minutes (10 * 60 * 1000)
 *    Keeps unused cached queries in memory for 10 minutes before garbage collection.
 *
 * 3. refetchOnWindowFocus: false
 *    Disables disruptive background refetches when switching browser tabs.
 *
 * 4. retry: 1
 *    Limits retry attempts to 1 on network failure to avoid overloading the backend.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000,   // 10 minutes (formerly cacheTime in v4)
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: 1,
    },
    mutations: {
      retry: 1,
    },
  },
});

/**
 * Standardized Query Key Factory.
 * Ensures consistent key structures across hooks, invalidations, and optimistic updates.
 */
export const tripQueryKeys = {
  all: ['trips'] as const,
  lists: () => [...tripQueryKeys.all, 'list'] as const,
  list: (params?: TripQueryParams) => {
    // Normalizes query parameters into a consistent object
    const normalized = {
      location: params?.location?.trim() || undefined,
      minPrice: params?.minPrice !== undefined && params?.minPrice !== null ? Number(params.minPrice) : undefined,
      maxPrice: params?.maxPrice !== undefined && params?.maxPrice !== null ? Number(params.maxPrice) : undefined,
      sortBy: params?.sortBy || 'createdAt',
      order: params?.order || 'desc',
      page: params?.page || 1,
      limit: params?.limit || 9,
    };
    return ['trips', normalized] as const;
  },
  details: () => [...tripQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...tripQueryKeys.details(), id] as const,
};
