import MutedCard from "@/components/cards/MuteCard";
import { ThemedText } from "@/components/ThemedText";
import { ThemedTextInput } from "@/components/ThemedTextInput";
import { ThemedView } from "@/components/ThemedView";
import { Colors } from "@/constants/Colors";
import { useAuth } from "@/context/AuthContext";
import { getUserProfile, updateUserProfile } from "@/lib/firebase/user";
import { RoundedButton } from "@/components/RoundButton";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function Settings() {
  const theme = useColorScheme() ?? "light";
  const insets = useSafeAreaInsets();
  const topPadding = Platform.OS === "android" ? 64 : 2 * insets.top;
  const queryClient = useQueryClient();
  const { refreshUser } = useAuth();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["userProfile"],
    queryFn: getUserProfile,
  });

  const [name, setName] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (profile?.name) setName(profile.name);
  }, [profile]);

  const mutation = useMutation({
    mutationFn: updateUserProfile,
    onSuccess: async () => {
      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ["userProfile"] });
      setIsEditing(false);
    },
    onError: () => {
      Alert.alert("Error", "Failed to save. Please try again.");
    },
  });

  const handleSave = () => {
    mutation.mutate({ name: name.trim() || undefined });
  };

  if (isLoading) {
    return (
      <ThemedView className="flex-1 items-center justify-center">
        <ActivityIndicator color={Colors[theme].highlight} />
      </ThemedView>
    );
  }

  return (
    <ThemedView className="flex-1" style={{ paddingTop: topPadding }}>
      <ScrollView className="px-4 py-6" keyboardShouldPersistTaps="handled">
        <ThemedText type="defaultSemiBold" className="mb-2 ml-1">
          Name
        </ThemedText>
        <MutedCard className="items-center justify-between">
          {isEditing ? (
            <ThemedTextInput
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={Colors[theme].mutedText}
              className="text-base font-medium flex-1 border-b border-gray-400 mr-2"
              maxLength={100}
              returnKeyType="done"
              autoFocus
            />
          ) : (
            <ThemedText className="text-base font-medium flex-1">
              {name || "No name set"}
            </ThemedText>
          )}
          <ThemedView className="flex-row">
            {isEditing ? (
              mutation.isPending ? (
                <ActivityIndicator
                  color={Colors[theme].accentBlue}
                  style={{ padding: 10 }}
                />
              ) : (
                <RoundedButton icon="check" onPress={handleSave} />
              )
            ) : (
              <RoundedButton icon="edit" onPress={() => setIsEditing(true)} />
            )}
          </ThemedView>
        </MutedCard>
      </ScrollView>
    </ThemedView>
  );
}
