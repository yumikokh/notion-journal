import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient, type Query } from '@tanstack/react-query';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';

const ONE_DAY_MS = 1000 * 60 * 60 * 24;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 60_000,
      // gcTime must exceed the persister maxAge below, otherwise restored
      // queries are immediately garbage-collected on next tick.
      gcTime: ONE_DAY_MS * 7,
    },
    mutations: {
      retry: 0,
    },
  },
});

const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'nikki-query-cache',
  throttleTime: 1000,
});

/**
 * Persist journal reads so the Today and Calendar screens hydrate instantly
 * on cold start, then revalidate in the background. Weekly AI analysis is
 * excluded (see use-weekly-analysis.ts) — large payload, regeneratable, and
 * per DATA_MODEL.md it is in-memory only.
 */
export function shouldPersistQuery(query: Query): boolean {
  const [root] = query.queryKey;
  return root === 'journal';
}

export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister: asyncStoragePersister,
  maxAge: ONE_DAY_MS * 7,
  // Bump when the cached shape changes incompatibly so old payloads are dropped.
  buster: 'v1',
  dehydrateOptions: {
    shouldDehydrateQuery: shouldPersistQuery,
  },
};
