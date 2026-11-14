import { QueryClient } from '@tanstack/angular-query-experimental';

/**
 * Global QueryClient instance configured with optimized production defaults:
 * - staleTime: 5 minutes (prevents refetching when navigating between pages or remounting components)
 * - gcTime: 10 minutes (maintains cache in memory for background reuse)
 * - refetchOnWindowFocus: false (avoids disruptive refetches when switching browser tabs)
 * - retry: 1 (limits failed request retries to prevent network thrashes)
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000,   // 10 minutes (formerly cacheTime in v4)
        refetchOnWindowFocus: false,
        retry: 1,
      },
      mutations: {
        retry: 1,
      },
    },
  });
}
