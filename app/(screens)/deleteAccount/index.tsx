import { Button } from "@/components/Button";
import Card from "@/components/Card";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Colors } from "@/constants/Colors";
import { useAuth } from "@/context/AuthContext";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import * as Updates from "expo-updates";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function Index() {
  const insets = useSafeAreaInsets();
  const topPadding = Platform.OS === "android" ? 48 : 2 * insets.top;
  const theme = useColorScheme() ?? "light";
  const { deleteAccount, user } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to permanently delete your account? This action cannot be undone and will delete all your data including:\n\n• All exercise logs\n• Exercise names\n• Labels\n• Account information",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setIsDeleting(true);
              await deleteAccount();
              await AsyncStorage.clear();

              // Reload the app
              if (Updates.reloadAsync) {
                await Updates.reloadAsync();
              } else {
                router.replace("/signin");
              }
            } catch (error: any) {
              setIsDeleting(false);
              console.error("Delete account error:", error);

              // Handle re-authentication required error
              if (error.code === "auth/requires-recent-login") {
                Alert.alert(
                  "Re-authentication Required",
                  "For security reasons, please sign out and sign in again before deleting your account.",
                  [{ text: "OK" }]
                );
              } else {
                Alert.alert(
                  "Error",
                  "Failed to delete account. Please try again or contact support."
                );
              }
            }
          },
        },
      ]
    );
  };

  return (
    <ThemedView className="flex-1" style={{ paddingTop: topPadding }}>
      <ScrollView className="flex-1 px-4 py-6">
        <View className="items-center justify-center mt-8 mb-6">
          <View
            className="w-24 h-24 rounded-full items-center justify-center mb-6"
            style={{
              backgroundColor: Colors[theme].danger + "20",
              borderWidth: 3,
              borderColor: Colors[theme].danger,
            }}
          >
            <MaterialIcons
              name="warning"
              size={48}
              color={Colors[theme].danger}
            />
          </View>

          <ThemedText
            type="title"
            className="text-2xl font-bold mb-2 text-center"
          >
            Delete Account
          </ThemedText>
          <ThemedText
            className="text-center opacity-70 px-4"
            style={{ color: Colors[theme].mutedText }}
          >
            This action is permanent and cannot be undone
          </ThemedText>
        </View>

        <Card className="mb-4">
          <View className="py-2">
            <ThemedText
              type="defaultSemiBold"
              className="mb-4"
              style={{ color: Colors[theme].danger }}
            >
              What will be deleted:
            </ThemedText>

            <View className="flex-row items-start mb-3">
              <MaterialIcons
                name="close"
                size={20}
                color={Colors[theme].danger}
                style={{ marginRight: 8, marginTop: 2 }}
              />
              <View className="flex-1">
                <ThemedText className="opacity-90">
                  All your exercise logs and workout history
                </ThemedText>
              </View>
            </View>

            <View className="flex-row items-start mb-3">
              <MaterialIcons
                name="close"
                size={20}
                color={Colors[theme].danger}
                style={{ marginRight: 8, marginTop: 2 }}
              />
              <View className="flex-1">
                <ThemedText className="opacity-90">
                  Custom exercise names and saved exercises
                </ThemedText>
              </View>
            </View>

            <View className="flex-row items-start mb-3">
              <MaterialIcons
                name="close"
                size={20}
                color={Colors[theme].danger}
                style={{ marginRight: 8, marginTop: 2 }}
              />
              <View className="flex-1">
                <ThemedText className="opacity-90">
                  All labels and label assignments
                </ThemedText>
              </View>
            </View>

            <View className="flex-row items-start">
              <MaterialIcons
                name="close"
                size={20}
                color={Colors[theme].danger}
                style={{ marginRight: 8, marginTop: 2 }}
              />
              <View className="flex-1">
                <ThemedText className="opacity-90">
                  Your account and profile information
                </ThemedText>
              </View>
            </View>
          </View>
        </Card>

        {user && (
          <Card className="mb-6">
            <View className="py-2">
              <ThemedText type="defaultSemiBold" className="mb-3">
                Account Details:
              </ThemedText>
              <ThemedText className="text-sm opacity-70">
                Email: {user.email}
              </ThemedText>
              {user.displayName && (
                <ThemedText className="text-sm opacity-70 mt-1">
                  Name: {user.displayName}
                </ThemedText>
              )}
            </View>
          </Card>
        )}

        <View className="mb-8">
          <Button
            type="danger"
            onPress={handleDeleteAccount}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting Account..." : "Delete My Account"}
          </Button>
        </View>

        <View className="mb-4">
          <Button
            type="default"
            onPress={() => router.back()}
            disabled={isDeleting}
          >
            Cancel
          </Button>
        </View>
      </ScrollView>
    </ThemedView>
  );
}
