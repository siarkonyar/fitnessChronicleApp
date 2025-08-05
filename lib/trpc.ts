// src/lib/trpc.ts (NEW FILE YOU ARE CREATING)
import { QueryClient } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '../types/trpc'; // <--- IMPORTANT: This now points to your types file!
import { auth } from './firebase'; // Your Firebase client auth instance

// 1. Create a tRPC instance with React Query integration
export const trpc = createTRPCReact<AppRouter>();

// 2. Configure the Query Client (for React Query)
export const queryClient = new QueryClient();

// 3. Create your tRPC client (to be used within the Provider)
export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: process.env.EXPO_PUBLIC_BACKEND_URL || "", // <--- IMPORTANT: Use your server's actual IP address or domain
      async headers() {
        const user = auth.currentUser;
        if (user) {
          const idToken = await user.getIdToken();
          return {
            Authorization: `Bearer ${idToken}`, // Send ID token to server
          };
        }
        return {};
      },
    }),
  ],
});
