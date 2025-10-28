import { Button } from "@/components/Button";
import Card from "@/components/Card";
import UserLabelList from "@/components/lists/UserLabelList";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import * as Updates from "expo-updates";
import React, { useState } from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
  useColorScheme,
} from "react-native";
import { auth } from "../../../lib/firebase";

export default function Settings() {
  const [refreshing, setRefreshing] = useState(false);
  const theme = useColorScheme() ?? "light";

  const handleSignout = async () => {
    try {
      await auth.signOut();
      await AsyncStorage.clear();
      // Attempt to fully reload the app after sign-out
      if (Updates.reloadAsync) {
        await Updates.reloadAsync();
      } else {
        // Fallback: navigate to the signin screen
        router.replace("/signin");
      }
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
            colors={[Colors[theme].highlight]} // Android
            tintColor={Colors[theme].highlight} // iOS
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
