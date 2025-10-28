// App.tsx (or your main component) - UPDATED FOR EMAIL/PASSWORD
import React, { useEffect, useState } from "react";
import { Text, useColorScheme, View } from "react-native";

import { QueryClientProvider } from "@tanstack/react-query";
import { Link, router } from "expo-router";
import { onAuthStateChanged, User } from "firebase/auth"; // Firebase Auth types
import { Colors } from "../../constants/Colors";
import { auth } from "../../lib/firebase"; // Your Firebase client setup
import { queryClient, trpc, trpcClient } from "../../lib/trpc"; // Your tRPC setup
import MyIcon from "../LogoIcon";
import { ThemedView } from "../ThemedView";
import GoogleAuth from "./GoogleAuth";

export default function AuthPage() {
  const theme = useColorScheme() ?? "light";
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  /*   const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false); */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      // setAuthLoading(false); // Auth operation complete
    });
    return unsubscribe; // Cleanup subscription
  }, []);

  useEffect(() => {
    if (currentUser) {
      router.push("/(tabs)"); // Navigate to home page on successful login
    }
  }, [currentUser]);

  /* const handleSignUp = async () => {
    setAuthLoading(true);
    try {
      await signUpWithEmail(email, password);
      router.replace("/(tabs)");
      // User will be set by onAuthStateChanged
    } catch (err: any) {
      Alert.alert("Sign Up Error", err.message);
      setAuthLoading(false); // Authentication failed
    }
  };

  const handleSignIn = async () => {
    setAuthLoading(true);
    try {
      await signInWithEmail(email, password);
      // User will be set by onAuthStateChanged
    } catch (err: any) {
      Alert.alert("Sign In Error", err.message);
      setAuthLoading(false); // Authentication failed
    }
  }; */

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
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
            {/* <ThemedTextInput
              placeholder="Email"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={() => Keyboard.dismiss()}
              className="w-full mb-4 p-3 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-900"
            />
            <ThemedTextInput
              placeholder="Password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={() => Keyboard.dismiss()}
              className="w-full mb-4 p-3 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-900"
            />
            {authLoading ? (
              <ActivityIndicator size="small" color="#007bff" />
            ) : (
              <View className="space-y-3">
                <Button
                  title="Sign Up"
                  onPress={handleSignUp}
                  color="#007bff"
                />
                <Button
                  title="Sign In"
                  onPress={handleSignIn}
                  color="#28a745"
                />
              </View>
            )} */}
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
            </View>
            <GoogleAuth />
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
    </trpc.Provider>
  );
}
