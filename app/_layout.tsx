// Must stay first: the Firebase SDKs only accept an emulator before their
// first request.
import { isUsingEmulators } from "@/lib/firebase/emulators";

import { ConnectivityProvider } from "@/context/ConnectivityContext";
import { useAnalyticsConsent } from "@/hooks/useAnalyticsConsent";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useScreenTracking } from "@/hooks/useScreenTracking";
import { SheetModalProvider } from "@/context/SheetBlurTargetContext";
import NetInfo from "@react-native-community/netinfo";
import appCheck from "@react-native-firebase/app-check";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { onlineManager } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import * as Application from "expo-application";
import "expo-dev-client";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { PostHogProvider } from "posthog-react-native";
import React, { useEffect, useState } from "react";
import { CACHE_MAX_AGE_MS, createAccountQueryCache } from "@/lib/queryCache";
import { posthog } from "@/lib/analytics/posthog";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { AuthProvider, useAuth } from "../context/AuthContext";
import "../global.css";

onlineManager.setEventListener((setOnline) => {
  return NetInfo.addEventListener((state) => {
    setOnline(!!state.isConnected);
  });
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
          debugToken: __DEV__
            ? process.env.EXPO_PUBLIC_APPCHECK_DEBUG_TOKEN
            : undefined,
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <ConnectivityProvider>
          <AccountQueryProvider>
            <SheetModalProvider>
              {posthog ? (
                <PostHogProvider client={posthog} autocapture={false}>
                  <AppSetup />
                </PostHogProvider>
              ) : (
                <AppSetup />
              )}
            </SheetModalProvider>
          </AccountQueryProvider>
        </ConnectivityProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

function AccountQueryProvider({ children }: { children: React.ReactNode }) {
  const { user, authLoading } = useAuth();
  if (authLoading) return null;
  const uid = user?.uid ?? null;
  return (
    <AccountQueryCache key={JSON.stringify(uid)} uid={uid}>
      {children}
    </AccountQueryCache>
  );
}

function AccountQueryCache({ uid, children }: {
  uid: string | null;
  children: React.ReactNode;
}) {
  // Remounting on an identity change isolates even requests still in flight
  // against the old client. They cannot populate the incoming user's cache.
  const [{ client, persister }] = useState(() =>
    createAccountQueryCache(uid, isUsingEmulators),
  );
  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{
        persister,
        maxAge: CACHE_MAX_AGE_MS,
        buster: Application.nativeApplicationVersion ?? "1",
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}

function AppSetup() {
  const { isAuthenticated } = useAuth();
  const colorScheme = useColorScheme();

  // Both live here rather than in RootLayout because they need what only this
  // component is inside: useScreenTracking reads the router via usePathname,
  // which resolves only within the Stack tree below.
  useAnalyticsConsent();
  useScreenTracking();

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
