// App.tsx
import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { QueryClientProvider } from "@tanstack/react-query"; // Directly import QueryClientProvider
import { queryClient, trpc, trpcClient } from "../lib/trpc";

import AuthPage from "../components/AuthPage"; // Import the new component

export default function SignIn() {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          {/* Render the actual content inside the providers */}
          <AuthPage />
        </SafeAreaProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
