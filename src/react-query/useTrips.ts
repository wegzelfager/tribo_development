import { useQuery, type UseQueryResult, type UndefinedInitialDataOptions } from '@tanstack/react-query';
import { fetchTrips } from './api';
import { tripQueryKeys } from './queryClient';
import type { TripListResponse, TripQueryParams } from './types';

export interface UseTripsOptions
  extends Omit<
    UndefinedInitialDataOptions<TripListResponse, Error, TripListResponse, ReturnType<typeof tripQueryKeys.list>>,
    'queryKey' | 'queryFn'
  > {}

/**
 * Reusable custom hook wrapping TanStack React Query (v5) `useQuery` for trips.
 *
 * - Automatically derives the composite queryKey from all query parameters:
 *   `['trips', { location, minPrice, maxPrice, page, limit, sortBy, order }]`
 * - Each filter permutation is cached separately and deduplicated.
 * - Respects global 5-minute staleTime: navigating back and forth or remounting
 *   components consumes the cached data immediately without redundant network hits.
 * - Passes `signal` for automatic in-flight cancellation when filters change before response returns.
 */
export function useTrips(
  params?: TripQueryParams,
  options?: UseTripsOptions
): UseQueryResult<TripListResponse, Error> {
  const queryKey = tripQueryKeys.list(params);

  return useQuery({
    queryKey,
    queryFn: ({ signal }) => fetchTrips(params, signal),
    placeholderData: (previousData) => previousData, // Keeps previous page data while loading next page
    ...options,
  });
}
