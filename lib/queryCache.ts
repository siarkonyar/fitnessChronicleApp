import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient } from "@tanstack/react-query";

export const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Each account and backend gets its own memory cache and persisted snapshot. */
export function createAccountQueryCache(uid: string | null, usingEmulators: boolean) {
  const key = JSON.stringify([
    "HERCULE_QUERY_CACHE", usingEmulators ? "emulator" : "live", uid,
  ]);
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        gcTime: CACHE_MAX_AGE_MS,
        retry: 2,
        refetchOnReconnect: true,
        refetchOnWindowFocus: false,
      },
    },
  });
  const persister = createAsyncStoragePersister({ storage: AsyncStorage, key });
  return { client, persister, key };
}
