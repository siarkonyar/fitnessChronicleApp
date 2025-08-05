// App.tsx (or your main component) - UPDATED FOR EMAIL/PASSWORD
import * as AuthSession from "expo-auth-session";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Button,
  ScrollView,
  View,
} from "react-native";

import { QueryClientProvider } from "@tanstack/react-query";
import { router } from "expo-router";
import { User, onAuthStateChanged } from "firebase/auth"; // Firebase Auth types
import { auth } from "../lib/firebase"; // Your Firebase client setup
import { queryClient, trpc, trpcClient } from "../lib/trpc"; // Your tRPC setup
import { signInWithEmail, signUpWithEmail } from "./Auth"; // Your NEW Auth functions
import { ThemedTextInput } from "./ThemedTextInput"; // Your themed input component
import { ThemedView } from "./ThemedView";

export default function AuthPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false); // To show loading state for auth operations

  // Form fields for fitness log
  const [activity, setActivity] = useState("");
  const [duration, setDuration] = useState("");
  const [calories, setCalories] = useState("");
  const [notes, setNotes] = useState("");

  /* // ... inside your AuthScreen component
  useEffect(() => {
    const redirectUri = AuthSession.makeRedirectUri({
      useProxy: false, // Set to false if you are not using an Expo managed workflow proxy
      native: true, // Essential for native builds (simulators count!)
      // We don't need a scheme for Expo Go, as it generates one.
      // If you were building a standalone app, you'd define a scheme here.
    });
    console.log("Redirect URI for Simulator:", redirectUri);
  }, []); */

  // Listen for Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false); // Auth operation complete
    });
    return unsubscribe; // Cleanup subscription
  }, []);

  useEffect(() => {
    if (currentUser) {
      router.push("/(tabs)"); // Navigate to home page on successful login
    }
  }, [currentUser]);

  // tRPC hooks for fitness logs
  const {
    data: fitnessLogs,
    isLoading,
    error,
    refetch,
  } = trpc.fitness.getLogs.useQuery(
    undefined, // No input needed for getLogs
    { enabled: !!currentUser } // Only fetch if user is logged in
  );

  /* const addLogMutation = trpc.fitness.addLog.useMutation({
    onSuccess: () => {
      Alert.alert("Success", "Fitness log added!");
      refetch(); // Refetch logs after adding one
      // Clear form
      setActivity("");
      setDuration("");
      setCalories("");
      setNotes("");
    },
    onError: (err) => {
      Alert.alert("Error", `Failed to add log: ${err.message}`);
      console.error("Add Log Error:", err);
    },
  }); */

  const handleSignUp = async () => {
    setAuthLoading(true);
    try {
      await signUpWithEmail(email, password);
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
  };

  /* const handleAddLog = () => {
    if (!activity || !duration) {
      Alert.alert("Validation", "Activity and Duration are required.");
      return;
    }
    addLogMutation.mutate({
      date: new Date().toISOString(),
      activity,
      durationMinutes: parseInt(duration),
      caloriesBurned: calories ? parseInt(calories) : undefined,
      notes: notes || undefined,
    });
  }; */

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <ScrollView>
          <ThemedView className="flex-1 items-center justify-center h-screen p-4">
            <ThemedView className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 w-full max-w-md">
              <ThemedTextInput
                placeholder="Email"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                className="w-full mb-4 p-3 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-900"
              />
              <ThemedTextInput
                placeholder="Password"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
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
              )}
            </ThemedView>
          </ThemedView>

          {/* {currentUser && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Add New Fitness Log</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Activity (e.g., Running, Yoga)"
                    value={activity}
                    onChangeText={setActivity}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Duration (minutes)"
                    keyboardType="numeric"
                    value={duration}
                    onChangeText={setDuration}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Calories Burned (optional)"
                    keyboardType="numeric"
                    value={calories}
                    onChangeText={setCalories}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Notes (optional)"
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                  />
                  <Button
                    title="Add Log"
                    onPress={handleAddLog}
                    disabled={addLogMutation.isPending}
                  />
                </View>
              )} */}
          {/*
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Your Fitness Logs</Text>
                {isLoading && <Text>Loading logs...</Text>}
                {error && (
                  <Text style={styles.errorText}>
                    Error loading logs: {error.message}
                  </Text>
                )}
                {!currentUser && <Text>Sign in to view your logs.</Text>}
                {currentUser && fitnessLogs && fitnessLogs.length === 0 && (
                  <Text>No logs yet. Add one!</Text>
                )}
                {currentUser && fitnessLogs && fitnessLogs.length > 0 && (
                  <View>
                    {fitnessLogs.map((log) => (
                      <View key={log.id} style={styles.logItem}>
                        <Text style={styles.logText}>
                          <Text style={styles.logActivity}>{log.activity}</Text>{" "}
                          on {new Date(log.date).toLocaleDateString()}
                        </Text>
                        <Text style={styles.logText}>
                          Duration: {log.durationMinutes} min
                          {log.caloriesBurned
                            ? ` | Calories: ${log.caloriesBurned}`
                            : ""}
                        </Text>
                        {log.notes && (
                          <Text style={styles.logText}>Notes: {log.notes}</Text>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </View> */}
        </ScrollView>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
