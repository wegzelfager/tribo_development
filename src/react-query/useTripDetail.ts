import { useQuery, type UseQueryResult, type UndefinedInitialDataOptions } from '@tanstack/react-query';
import { fetchTripById } from './api';
import { tripQueryKeys } from './queryClient';
import type { Trip } from './types';

export interface UseTripDetailOptions
  extends Omit<
    UndefinedInitialDataOptions<Trip, Error, Trip, ReturnType<typeof tripQueryKeys.detail>>,
    'queryKey' | 'queryFn'
  > {}

/**
 * Custom hook wrapping `useQuery` to fetch individual trip details by ID.
 * Cached per ID under `['trips', 'detail', id]`.
 */
export function useTripDetail(
  id: string | undefined | null,
  options?: UseTripDetailOptions
): UseQueryResult<Trip, Error> {
  const queryKey = tripQueryKeys.detail(id || '');

  return useQuery({
    queryKey,
    queryFn: ({ signal }) => {
      if (!id) throw new Error('Trip ID is required');
      return fetchTripById(id, signal);
    },
    enabled: Boolean(id),
    ...options,
  });
}
