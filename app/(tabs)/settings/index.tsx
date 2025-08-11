import { Button } from "@/components/Button";
import Card from "@/components/Card";
import { ThemedText } from "@/components/ThemedText";
import { router } from "expo-router";
import React from "react";
import { Alert, SafeAreaView, ScrollView } from "react-native";
import { auth } from "../../../lib/firebase";

export default function Settings() {
  const handleSignout = async () => {
    try {
      await auth.signOut();
      // Force navigation to the root index after sign out
      // TODO: THIS STILL DOES NOT WORK
      router.replace("/");
    } catch (error) {
      console.error("Sign out error:", error);
      Alert.alert("Error", "Failed to sign out. Please try again.");
    }
  };
  const user = auth.currentUser; // Use the Auth context to check authentication status
  return (
    <>
      <SafeAreaView>
        <ScrollView className="px-4 py-6">
          <Card>
            <ThemedText>
              You are currently signed in as {user?.email}
            </ThemedText>
            <Button type="danger" onPress={handleSignout}>
              Sign Out
            </Button>
          </Card>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}
