import { ConnectivityProvider } from "@/context/ConnectivityContext";
import { useColorScheme } from "@/hooks/useColorScheme";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "expo-dev-client";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import React from "react";
import "react-native-reanimated";
import { AuthProvider, useAuth } from "../context/AuthContext";
import "../global.css";

const queryClient = new QueryClient();

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
    BebasNeue: require("../assets/fonts/BebasNeue-Regular.ttf"),
    Inter: require("../assets/fonts/Inter/static/Inter_18pt-Medium.ttf")
  });

  if (!loaded) {
    return null;
  }

  return (
    <AuthProvider>
      <ConnectivityProvider>
        <QueryClientProvider client={queryClient}>
          <AppSetup />
        </QueryClientProvider>
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
