import { trpc } from "@/lib/trpc";
// import { EmojiSchema } from "@/types/types";
import React from "react";
import { Modal, Pressable, Text, View } from "react-native";
// Using rn-emoji-keyboard which provides a theme API for dark mode
import { useColorScheme } from "@/hooks/useColorScheme";
import EmojiPicker from "rn-emoji-keyboard";
// import { z } from "zod";
import { Button } from "../Button";
import Card from "../Card";
import { ThemedText } from "../ThemedText";
import { ThemedTextInput } from "../ThemedTextInput";

type EmojiItem = {
  id?: string;
  emoji: string;
  description: string;
  dates?: string[];
};

export default function UserEmojiList() {
  const addEmojiMutation = trpc.fitness.addEmoji.useMutation();
  const { data: emojisRaw, isLoading } = trpc.fitness.getAllEmojis.useQuery();
  const utils = trpc.useUtils();

  const [isAddEmojiOpen, setIsAddEmojiOpen] = React.useState(false);
  const [emoji, setEmoji] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = React.useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const emojiTheme = {
    backdrop: isDark ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.5)",
    knob: isDark ? "#4B5563" : "#D1D5DB",
    container: isDark ? "#1F2937" : "#FFFFFF",
    header: isDark ? "#E5E7EB" : "#111827",
    skinTonesContainer: isDark ? "#111827" : "#F3F4F6",
    category: {
      icon: isDark ? "#9CA3AF" : "#6B7280",
      iconActive: isDark ? "#FFFFFF" : "#111827",
      container: isDark ? "#111827" : "#F3F4F6",
      containerActive: isDark ? "#374151" : "#E5E7EB",
    },
    search: {
      text: isDark ? "#FFFFFF" : "#111827",
      placeholder: isDark ? "#9CA3AF" : "#6B7280",
      icon: isDark ? "#E5E7EB" : "#374151",
      background: isDark ? "#111827" : "#F3F4F6",
    },
  } as const;

  // quick-pick grid removed in favor of full emoji selector

  const canSubmit =
    emoji.trim().length > 0 && description.trim().length > 0 && !isSubmitting;

  async function handleAddEmoji() {
    if (!canSubmit) return;
    try {
      setIsSubmitting(true);
      await addEmojiMutation.mutateAsync({
        emoji: emoji.trim(),
        description: description.trim(),
        dates: [] as string[],
      });
      await utils.fitness.getAllEmojis.invalidate();
      setIsAddEmojiOpen(false);
      setEmoji("");
      setDescription("");
    } finally {
      setIsSubmitting(false);
    }
  }
  const emojis: EmojiItem[] = Array.isArray(emojisRaw)
    ? (emojisRaw as EmojiItem[])
    : [];

  if (isLoading) {
    return <ThemedText className="text-lg text-center">Loading...</ThemedText>;
  }
  return (
    <>
      <Card>
        {emojis.length > 0 ? (
          <View className="flex-col flex-wrap gap-4 mb-3">
            {emojis.map((item, index) => (
              <View
                key={item.id ?? `${item.emoji}-${index}`}
                className="flex-row items-center"
              >
                <Text className="text-3xl">{item.emoji}</Text>
                <ThemedText className="text-center">
                  {item.description}
                </ThemedText>
              </View>
            ))}
          </View>
        ) : (
          <ThemedText className="opacity-70 mb-3">
            No emojis yet. Add one below.
          </ThemedText>
        )}
        <Button onPress={() => setIsAddEmojiOpen(true)}>+ add Emoji</Button>
      </Card>

      <Modal
        visible={isAddEmojiOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsAddEmojiOpen(false)}
      >
        <View className="flex-1 items-center justify-center bg-black/50">
          <Card className="w-11/12 max-w-md">
            <ThemedText className="text-xl font-semibold mb-2">
              Add Emoji
            </ThemedText>
            <View className="items-center mb-3">
              <Pressable onPress={() => setIsEmojiPickerOpen(true)}>
                <Text className="text-6xl mb-2">{emoji || "😀"}</Text>
              </Pressable>
              <ThemedText className="opacity-70 mb-2">
                Tap emoji to choose
              </ThemedText>
            </View>

            <ThemedText className="font-semibold mb-1">Description</ThemedText>
            <ThemedTextInput
              value={description}
              onChangeText={setDescription}
              placeholder="What does this emoji represent?"
              maxLength={100}
              className="w-full border border-gray-400/40 rounded-md px-3 py-2 mb-4"
            />
            <View className="flex-row justify-end gap-2">
              <Button type="default" onPress={() => setIsAddEmojiOpen(false)}>
                Cancel
              </Button>
              <Button
                type="primary"
                onPress={handleAddEmoji}
                disabled={!canSubmit}
                style={{ opacity: canSubmit ? 1 : 0.5 }}
              >
                {isSubmitting ? "Adding..." : "Add Emoji"}
              </Button>
            </View>
            <EmojiPicker
              open={isEmojiPickerOpen}
              onClose={() => setIsEmojiPickerOpen(false)}
              onEmojiSelected={(e) => {
                setEmoji(e.emoji);
                setIsEmojiPickerOpen(false);
              }}
              theme={emojiTheme}
              enableSearchBar
              categoryPosition="top"
            />
          </Card>
        </View>
      </Modal>
    </>
  );
}
