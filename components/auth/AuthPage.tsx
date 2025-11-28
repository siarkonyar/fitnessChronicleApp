// App.tsx (or your main component) - UPDATED FOR EMAIL/PASSWORD
import React, { useCallback, useEffect, useState } from "react";
import { Text, useColorScheme, View } from "react-native";

import {
  FirebaseAuthTypes,
  getAuth,
  onAuthStateChanged,
} from "@react-native-firebase/auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Link, router } from "expo-router";
import { Colors } from "../../constants/Colors";
import MyIcon from "../LogoIcon";
import { ThemedView } from "../ThemedView";
import AuthButtons from "./AuthButtons";

const queryClient = new QueryClient();

export default function AuthPage() {
  const theme = useColorScheme() ?? "light";
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);

  const handleAuthStateChanged = useCallback(
    (user: FirebaseAuthTypes.User | null) => {
      setUser(user);
      if (initializing) setInitializing(false);
    },
    [initializing]
  );

  useEffect(() => {
    if (user) {
      router.push("/(tabs)"); // Navigate to home page on successful login
    }
    const subscriber = onAuthStateChanged(getAuth(), handleAuthStateChanged);
    return subscriber; // unsubscribe on unmount
  }, [user, handleAuthStateChanged]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemedView
        className="flex-1 items-center justify-center h-screen p-4"
        lightColor="transparent"
        darkColor="transparent"
      >
        <ThemedView
          className="p-6 w-full max-w-md"
          lightColor="transparent"
          darkColor="transparent"
        >
          <View className="items-center mb-4">
            <Text
              style={{
                fontSize: 32,
                fontWeight: "600",
                marginBottom: 8,
                color: Colors[theme].highlight,
              }}
            >
              Welcome to
            </Text>
            <View className="flex-row items-center mb-8">
              <MyIcon size={48} color={Colors[theme].highlight} />
              <Text
                style={{
                  fontSize: 36,
                  fontWeight: "600",
                  color: Colors[theme].highlight,
                }}
              >
                ercule
              </Text>
            </View>
            <Text className="text-center text-white">
              Log in to start logging your workouts and tracking your progress
              today.
            </Text>
            <AuthButtons />
          </View>
        </ThemedView>
      </ThemedView>
      <ThemedView lightColor="transparent" darkColor="transparent">
        <Text
          className="text-center text-xs"
          style={{
            color:
              theme === "light"
                ? Colors.light.mutedText
                : Colors.dark.mutedText,
          }}
        >
          © 2025 Hercule. All rights reserved.
        </Text>
        <Text
          className="text-center text-xs"
          style={{
            color:
              theme === "light"
                ? Colors.light.mutedText
                : Colors.dark.mutedText,
          }}
        >
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </Text>
        <Text
          className="text-center mb-2 text-xs"
          style={{
            color:
              theme === "light"
                ? Colors.light.mutedText
                : Colors.dark.mutedText,
          }}
        >
          Learn more about how we handle your data in our{" "}
          <Link href="https://siarkonyar.com/tos" className="underline">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="https://siarkonyar.com/privacy" className="underline">
            Privacy Policy
          </Link>
          .
        </Text>
      </ThemedView>
    </QueryClientProvider>
  );
}
