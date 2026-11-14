/**
 * TanStack React Query (v5) Trip Feature Module
 *
 * Provides:
 * - QueryClient instance with optimized defaults (staleTime 5m, gcTime 10m, refetchOnWindowFocus false, retry 1)
 * - tripQueryKeys factory
 * - useTrips(queryParams) custom query hook with per-filter caching & deduplication
 * - useTripDetail(id) custom query hook
 * - useCreateTrip, useUpdateTrip, useDeleteTrip mutations with optimistic updates and query invalidation
 * - TypeScript DTO definitions matching the backend models
 */

export * from './types';
export * from './api';
export * from './queryClient';
export * from './useTrips';
export * from './useTripDetail';
export * from './useTripMutations';
