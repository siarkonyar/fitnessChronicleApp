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
  const palette = Colors[theme];
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);

  const handleAuthStateChanged = useCallback(
    (user: FirebaseAuthTypes.User | null) => {
      setUser(user);
      if (initializing) setInitializing(false);
    },
    [initializing],
  );

  useEffect(() => {
    if (user) {
      router.push("/(tabs)");
    }
    const subscriber = onAuthStateChanged(getAuth(), handleAuthStateChanged);
    return subscriber;
  }, [user, handleAuthStateChanged]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemedView
        className="flex-1 items-center justify-center px-4 py-8"
        lightColor="transparent"
        darkColor="transparent"
      >
        <View
          pointerEvents="none"
          className="absolute -left-[80px] -top-[60px] h-[220px] w-[220px] rounded-full"
          style={{ backgroundColor: `${palette.highlight}22` }}
        />
        <View
          pointerEvents="none"
          className="absolute -bottom-[100px] -right-[70px] h-[260px] w-[260px] rounded-full"
          style={{ backgroundColor: `${palette.secondary}18` }}
        />

        <ThemedView
          className="w-full max-w-md"
          lightColor="transparent"
          darkColor="transparent"
        >
          <View className="items-center">
            <MyIcon size={52} color={palette.highlight} />

            <Text
              className="mb-3 text-[14px] font-bold tracking-[3px]"
              style={{ color: palette.highlight }}
            >
              FITNESS CHRONICLE
            </Text>

            <Text
              className="text-center text-[34px] font-extrabold leading-10"
              style={{ color: palette.text }}
            >
              Train with intent.
            </Text>

            <Text
              className="mt-3 text-center text-base leading-6"
              style={{ color: `${palette.mutedText}CC` }}
            >
              Log workouts, assign labels, and keep momentum visible at a
              glance.
            </Text>

            <AuthButtons />

            <View className="mt-5 flex-row flex-wrap justify-center gap-2">
              {["Workout logging", "Daily labels"].map((feature) => (
                <View
                  key={feature}
                  className="rounded-full border px-3 py-2"
                  style={{
                    borderColor: palette.cardBorderColor,
                    backgroundColor: `${palette.cardBackground}B8`,
                  }}
                >
                  <Text
                    className="text-xs font-semibold"
                    style={{ color: `${palette.text}D1` }}
                  >
                    {feature}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </ThemedView>

        <ThemedView
          lightColor="transparent"
          darkColor="transparent"
          className="mb-4 px-4"
        >
          <Text
            className="text-center text-xs leading-5"
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
            className="text-center text-xs leading-5"
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
            className="text-center mb-2 text-xs leading-5"
            style={{ color: palette.mutedText }}
          >
            Learn more about how we handle your data in our{" "}
            <Link
              href="https://siarkonyar.com/tos"
              className="underline"
              style={{ color: palette.highlight }}
            >
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link
              href="https://siarkonyar.com/privacy"
              className="underline"
              style={{ color: palette.highlight }}
            >
              Privacy Policy
            </Link>
            .
          </Text>
        </ThemedView>
      </ThemedView>
    </QueryClientProvider>
  );
}
