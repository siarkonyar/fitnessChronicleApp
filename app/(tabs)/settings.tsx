import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@react-navigation/elements";
import { router } from "expo-router";
import React from "react";
import { Alert, SafeAreaView } from "react-native";
import { auth } from "../../lib/firebase";

export default function Settings() {
  const handleSignout = () => {
    auth.signOut().catch((error) => {
      console.error("Sign out error:", error);
      Alert.alert("Error", "Failed to sign out. Please try again.");
    });
    router.replace("../../"); // Redirect to auth page after sign out
  };
  const user = auth.currentUser; // Use the Auth context to check authentication status
  return (
    <>
      <SafeAreaView>
        <ThemedView>
          <ThemedText>You are currently signed in as {user?.email}</ThemedText>
          <Button onPress={handleSignout}>Sign Out</Button>
        </ThemedView>
      </SafeAreaView>
    </>
  );
}
