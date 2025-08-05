import { useColorScheme } from "@/hooks/useColorScheme";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import "react-native-reanimated";
import { AuthProvider, useAuth } from "../context/AuthContext"; // Import AuthProvider
import "../global.css";
import { queryClient, trpc, trpcClient } from "../lib/trpc";

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  if (!loaded) {
    // Show a loading screen while fonts are loading
    return null;
  }

  return (
    <AuthProvider>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
          <QueryClientProvider client={queryClient}>
            <AppStack />
            <StatusBar style="auto" />
          </QueryClientProvider>
        </trpc.Provider>
      </ThemeProvider>
    </AuthProvider>
  );
}

function AppStack() {
  const { isAuthenticated, authLoading } = useAuth();

  if (authLoading) {
    // Show a loading screen while auth state is loading
    return null;
  }

  return (
    <Stack>
      {isAuthenticated ? (
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      ) : (
        <Stack.Screen
          name="index"
          options={{ headerShown: false, title: "Home" }}
        />
      )}
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}
