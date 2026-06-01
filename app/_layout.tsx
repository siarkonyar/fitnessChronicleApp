import { ConnectivityProvider } from "@/context/ConnectivityContext";
import { useColorScheme } from "@/hooks/useColorScheme";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import appCheck from "@react-native-firebase/app-check";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { onlineManager, QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import * as Application from "expo-application";
import "expo-dev-client";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import React, { useEffect } from "react";
import "react-native-reanimated";
import { AuthProvider, useAuth } from "../context/AuthContext";
import "../global.css";

onlineManager.setEventListener((setOnline) => {
  return NetInfo.addEventListener((state) => {
    setOnline(!!state.isConnected);
  });
});

const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 min: serve cache without refetching
      gcTime: CACHE_MAX_AGE_MS, // keep unused data 24h (also enables persistence)
      retry: 2, // retry failed fetches (flaky mobile networks)
      refetchOnReconnect: true, // refresh when connectivity returns
      refetchOnWindowFocus: false, // explicit; off by default on RN
    },
  },
});

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: "HERCULE_QUERY_CACHE",
});

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
    BebasNeue: require("../assets/fonts/BebasNeue-Regular.ttf"),
    Inter: require("../assets/fonts/Inter/static/Inter_18pt-Medium.ttf"),
    "Inter-Bold": require("../assets/fonts/Inter/static/Inter_24pt-Bold.ttf"),
  });

  useEffect(() => {
    const initAppCheck = async () => {
      const provider = appCheck().newReactNativeFirebaseAppCheckProvider();
      provider.configure({
        apple: {
          // real devices attest; falls back to DeviceCheck on older hardware
          provider: __DEV__ ? "debug" : "appAttestWithDeviceCheckFallback",
        },
        android: {
          provider: __DEV__ ? "debug" : "playIntegrity",
        },
      });

      await appCheck().initializeAppCheck({
        provider,
        isTokenAutoRefreshEnabled: true,
      });
    };

    initAppCheck();
  }, []);

  if (!loaded) {
    return null;
  }

  return (
    <AuthProvider>
      <ConnectivityProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{
            persister,
            maxAge: CACHE_MAX_AGE_MS,
            buster: Application.nativeApplicationVersion ?? "1",
          }}
        >
          <AppSetup />
        </PersistQueryClientProvider>
      </ConnectivityProvider>
    </AuthProvider>
  );
}

function AppSetup() {
  const { isAuthenticated } = useAuth();
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={SCREEN_OPTIONS}>
        <Stack.Screen name="index" options={INDEX_OPTIONS} />
        <Stack.Screen name="signin" options={SIGNIN_OPTIONS} />
        <Stack.Protected guard={isAuthenticated}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(screens)" />
          <Stack.Screen name="offline" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Screen name="+not-found" />
      </Stack>
    </ThemeProvider>
  );
}

const SCREEN_OPTIONS = {
  animation: "none",
  contentStyle: { backgroundColor: "transparent" },
} as const;

const INDEX_OPTIONS = {
  title: "",
  headerLargeTitle: false,
  HeaderTitle: false,
  HeaderBackButton: false,
  headerTransparent: true,
  headerStyle: { backgroundColor: "transparent" },
} as const;

const SIGNIN_OPTIONS = {
  title: "",
  headerLargeTitle: false,
  HeaderTitle: false,
  headerBackButton: false,
  headerTransparent: true,
  headerStyle: { backgroundColor: "transparent" },
} as const;
