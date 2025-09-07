import { Button } from "@/components/Button";
import { ThemedText } from "@/components/ThemedText";
import { ThemedTextInput } from "@/components/ThemedTextInput";
import { ThemedView } from "@/components/ThemedView";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useServerErrorHandler } from "@/hooks/useServerErrorHandler";
import { trpc } from "@/lib/trpc";
import { LabelWithIdSchema } from "@/types/types";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Animated, { LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import EmojiPicker from "rn-emoji-keyboard";
import { z } from "zod";

export default function Index() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const labelId = params.id as string;
  type labelScheme = z.infer<typeof LabelWithIdSchema>;

  const { handleMutationError, handleQueryError } = useServerErrorHandler();
  const editLabelMutation = trpc.label.editLabel.useMutation({
    onError: (error) => {
      handleMutationError(error);
    },
  });
  const utils = trpc.useUtils();
  const theme = useColorScheme() ?? "light";

  // Get the label data
  const {
    data: labelData,
    isLoading,
    error,
  } = trpc.label.getLabelById.useQuery(
    { id: labelId },
    { enabled: !!labelId }
  ) as {
    data: labelScheme | undefined;
    isLoading: boolean;
    error: any;
  };

  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);

  // Initialize form with label data when it loads
  useEffect(() => {
    if (labelData) {
      setLabel(labelData.label);
      setDescription(labelData.description);
    }
  }, [labelData]);

  useEffect(() => {
    if (error) {
      handleQueryError(error);
    }
  }, [error, handleQueryError]);

  const emojiTheme = {
    backdrop: "rgba(0,0,0,0.5)",
    knob: Colors[theme].separator,
    container: Colors[theme].cardBackground,
    header: Colors[theme].text,
    skinTonesContainer: Colors[theme].inputBackground,
    category: {
      icon: Colors[theme].text,
      iconActive: Colors[theme].highlight,
      container: Colors[theme].inputBackground,
      containerActive: Colors[theme].separator,
    },
    search: {
      text: Colors[theme].text,
      placeholder: Colors[theme].mutedText,
      icon: Colors[theme].icon,
      background: Colors[theme].inputBackground,
    },
  } as const;

  const canSubmit =
    label.trim().length > 0 && description.trim().length > 0 && !isSubmitting;

  async function handleEditLabel() {
    if (!canSubmit || !labelId) return;
    try {
      setIsSubmitting(true);
      await editLabelMutation.mutateAsync({
        id: labelId,
        label: label.trim(),
        description: description.trim(),
      });
      await utils.label.getAllLabels.invalidate();
      await utils.label.getLabelById.invalidate({ id: labelId });
      router.push("/(tabs)/settings");
    } catch (error) {
      console.log(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <ThemedView className="flex-1 items-center justify-center">
        <ThemedText>Loading...</ThemedText>
      </ThemedView>
    );
  }

  if (!labelData) {
    return (
      <ThemedView className="flex-1 items-center justify-center">
        <ThemedText>Label not found</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView className="flex-1" style={{ paddingTop: 2 * insets.top }}>
      <ScrollView className="flex-1 p-4">
        <View className="p-6">
          <ThemedText className="text-2xl font-bold mb-2 text-center">
            Edit Label
          </ThemedText>
          <ThemedText className="text-sm opacity-70 text-center mb-6">
            Update label and description
          </ThemedText>

          <View className="items-center mb-6">
            <Pressable
              onPress={() => setIsEmojiPickerOpen(true)}
              className="rounded-2xl p-6 border border-gray-200/50 dark:border-gray-600/50 active:scale-95 transition-transform"
            >
              <Text className="text-6xl leading-[72px] mb-2">
                {label || "😀"}
              </Text>
            </Pressable>
            <ThemedText className="opacity-70 mt-3 text-center">
              Tap label to choose
            </ThemedText>
          </View>

          <ThemedText className="font-semibold mb-2">Description</ThemedText>
          <ThemedTextInput
            value={description}
            onChangeText={setDescription}
            placeholder=""
            maxLength={100}
            className="w-full border border-gray-300/50 dark:border-gray-600/50 rounded-xl px-4 py-3 mb-6 bg-white dark:bg-gray-800"
          />

          <Animated.View
            layout={LinearTransition}
            className="flex-row justify-end gap-3"
          >
            <Button
              type="danger"
              onPress={() => router.push("/(tabs)/settings")}
            >
              Cancel
            </Button>
            <Button
              type="primary"
              onPress={handleEditLabel}
              disabled={!canSubmit}
              style={{ opacity: canSubmit ? 1 : 0.5 }}
            >
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
          </Animated.View>

          <EmojiPicker
            open={isEmojiPickerOpen}
            onClose={() => setIsEmojiPickerOpen(false)}
            onEmojiSelected={(e) => {
              setLabel(e.emoji);
              setIsEmojiPickerOpen(false);
            }}
            theme={emojiTheme}
            categoryPosition="top"
          />
        </View>
      </ScrollView>
    </ThemedView>
  );
}
