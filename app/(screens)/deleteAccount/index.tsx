import { Button } from "@/components/Button";
import Card from "@/components/Card";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Colors } from "@/constants/Colors";
import { useAuth } from "@/context/AuthContext";
import { logEvent } from "@/lib/analytics/client";
import {
  APPLE_PROVIDER_ID,
  GOOGLE_PROVIDER_ID,
} from "@/lib/firebase/credentials";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import * as Updates from "expo-updates";
import React, { useState } from "react";
import { Alert, ScrollView, useColorScheme, View } from "react-native";

// Google and Apple each report a dismissed sign-in sheet their own way, and
// neither uses a Firebase error code.
const CANCELLATION_MARKERS = ["cancel", "1001", "-5"];

function isCancellation(error: unknown): boolean {
  const description = [
    (error as { code?: string })?.code,
    (error as { message?: string })?.message,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return CANCELLATION_MARKERS.some((marker) => description.includes(marker));
}

export default function Index() {
  const theme = useColorScheme() ?? "light";
  const { deleteAccount, user } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);

  const queryClient = useQueryClient();

  // Naming the provider makes the prompt predictable — people recognise the
  // Google or Apple sheet when it appears instead of being surprised by it.
  const providerId = user?.providerData?.[0]?.providerId;
  const providerName =
    providerId === APPLE_PROVIDER_ID
      ? "Apple"
      : providerId === GOOGLE_PROVIDER_ID
        ? "Google"
        : null;
  const signInDescription = providerName
    ? `sign in with ${providerName}`
    : "sign in again";

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to permanently delete your account? This action cannot be undone and will delete all your data including:\n\n• All exercise logs\n• Exercise names\n• Labels\n• Account information\n\nYou'll be asked to sign in again first, so we can confirm it's really you. Nothing is deleted until you do.",
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

              // Fired here, at the point of no return, rather than when the
              // screen opens. Paired with account_deleted it separates people
              // who confirmed and hit a failure from people who backed out.
              logEvent("account_delete_started", {});

              queryClient.clear();

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

              // deleteAccount reauthenticates before touching anything, so the
              // usual failure here is the user dismissing that prompt. Nothing
              // has been deleted in that case — say so, rather than implying
              // a partial delete.
              if (isCancellation(error)) {
                Alert.alert(
                  "Deletion Cancelled",
                  "Your account was not deleted. Confirming your sign-in is required to delete it.",
                  [{ text: "OK" }],
                );
              } else {
                Alert.alert(
                  "Error",
                  "Failed to delete account. Please try again or contact support.",
                );
              }
            }
          },
        },
      ],
    );
  };

  return (
    <ThemedView className="flex-1">
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
              <ThemedText className="opacity-70">
                Email: {user.email}
              </ThemedText>
              {user.displayName && (
                <ThemedText className="opacity-70 mt-1">
                  Name: {user.displayName}
                </ThemedText>
              )}
            </View>
          </Card>
        )}

        {/* Sits directly above the button so it is the last thing read
            before tapping. Deliberately not red: everything else on this
            page is a warning, so another red block would disappear into
            them. This is reassurance, and should look like it. */}
        <View
          className="flex-row items-start rounded-2xl border p-4 mb-6"
          style={{
            backgroundColor: Colors[theme].accentBlue + "14",
            borderColor: Colors[theme].accentBlue + "40",
          }}
        >
          <MaterialIcons
            name="verified-user"
            size={24}
            color={Colors[theme].accentBlue}
            style={{ marginRight: 12, marginTop: 1 }}
          />
          <View className="flex-1">
            <ThemedText
              type="defaultSemiBold"
              className="mb-1"
              style={{ color: Colors[theme].accentBlue }}
            >
              You&apos;ll need to sign in again
            </ThemedText>
            <ThemedText className="opacity-90">
              To confirm it&apos;s really you, we&apos;ll ask you to{" "}
              {signInDescription} before anything is removed.{" "}
              <ThemedText type="defaultSemiBold" className="opacity-100">
                Nothing is deleted until you do.
              </ThemedText>
            </ThemedText>
          </View>
        </View>

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
