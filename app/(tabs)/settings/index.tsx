import { Button } from "@/components/Button";
import Card from "@/components/Card";
import UserLabelList from "@/components/lists/UserLabelList";
import { ThemedText } from "@/components/ThemedText";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useState } from "react";
import { Alert, RefreshControl, ScrollView } from "react-native";
import { auth } from "../../../lib/firebase";

export default function Settings() {
  const [refreshing, setRefreshing] = useState(false);

  const handleSignout = async () => {
    try {
      await auth.signOut();
      await AsyncStorage.clear();
    } catch (error) {
      console.error("Sign out error:", error);
      Alert.alert("Error", "Failed to sign out. Please try again.");
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  };

  const user = auth.currentUser; // Use the Auth context to check authentication status
  return (
    <>
      <ScrollView
        className="px-4 py-6"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#ff5733"]} // Android
            tintColor="#ff5733" // iOS
          />
        }
      >
        <Card className="mb-4">
          <ThemedText>You are currently signed in as {user?.email}</ThemedText>
          <Button type="danger" onPress={handleSignout}>
            Sign Out
          </Button>
        </Card>
        <UserLabelList />
      </ScrollView>
    </>
  );
}
