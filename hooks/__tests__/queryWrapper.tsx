import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

/**
 * A fresh QueryClient per test, with retries off so a rejected query fails
 * on the first attempt instead of waiting out the default back-off.
 *
 * gcTime: Infinity schedules no garbage-collection timer. A finished mutation
 * otherwise starts a 5-minute one, which keeps Jest from exiting.
 */
export const createTestQueryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });

export const queryWrapper = (client: QueryClient) =>
  function QueryWrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
