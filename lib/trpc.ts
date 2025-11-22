// src/lib/trpc.ts
import { getAuth } from '@react-native-firebase/auth';
import { QueryClient } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '../types/trpc';

// 1. Create a tRPC instance with React Query integration
export const trpc = createTRPCReact<AppRouter>();

// 2. Configure the Query Client (for React Query)
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      retryDelay: 1000,
      staleTime: 30_000,
      gcTime: 5 * 60_000,
    },
  },
});

// 3. Create your tRPC client (to be used within the Provider)
export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: process.env.EXPO_PUBLIC_BACKEND_URL || "", // <--- IMPORTANT: Use your server's actual IP address or domain
      async headers() {
        try {
          const user = getAuth().currentUser;
          if (user) {
            const idToken = await user.getIdToken();
            return {
              Authorization: `Bearer ${idToken}`, // Send Firebase ID token to server
            };
          }
        } catch (error) {
          console.error('Error getting auth token:', error);
        }
        return {};
      },
    }),
  ],
});
