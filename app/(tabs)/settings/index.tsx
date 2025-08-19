import { Button } from "@/components/Button";
import Card from "@/components/Card";
import UserEmojiList from "@/components/lists/UserEmojiList";
import { ThemedText } from "@/components/ThemedText";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React from "react";
import { Alert, ScrollView } from "react-native";
import { auth } from "../../../lib/firebase";

export default function Settings() {
  const handleSignout = async () => {
    try {
      await auth.signOut();
      await AsyncStorage.clear();
    } catch (error) {
      console.error("Sign out error:", error);
      Alert.alert("Error", "Failed to sign out. Please try again.");
    }
  };
  const user = auth.currentUser; // Use the Auth context to check authentication status
  return (
    <>
      <ScrollView className="px-4 py-6">
        <Card className="mb-4">
          <ThemedText>You are currently signed in as {user?.email}</ThemedText>
          <Button type="danger" onPress={handleSignout}>
            Sign Out
          </Button>
        </Card>
        <UserEmojiList />
      </ScrollView>
    </>
  );
}
