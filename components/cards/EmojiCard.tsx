import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { trpc } from "@/lib/trpc";
import React from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import EmojiPicker from "rn-emoji-keyboard";
import { z } from "zod";
import { EmojiWithIdSchema } from "../../types/types";
import { Button } from "../Button";
import Card from "../Card";
import { ThemedText } from "../ThemedText";
import { ThemedTextInput } from "../ThemedTextInput";

interface EmojiCardProps {
  index: number;
  emoji: z.infer<typeof EmojiWithIdSchema>;
  editable?: boolean;
  onPress?: (emojiId: string) => void;
}

export default function EmojiCard({
  index,
  emoji,
  editable,
  onPress,
}: EmojiCardProps) {
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [localEmoji, setLocalEmoji] = React.useState(emoji.emoji);
  const [localDescription, setLocalDescription] = React.useState(
    emoji.description
  );
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const theme = useColorScheme() ?? "light";
  const insets = useSafeAreaInsets();
  const utils = trpc.useUtils();
  const editEmojiMutation = trpc.emoji.editEmoji.useMutation();

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
    localEmoji.trim().length > 0 &&
    localDescription.trim().length > 0 &&
    !isSubmitting;

  async function handleSave() {
    if (!canSubmit || !emoji.id) return;
    try {
      setIsSubmitting(true);
      await editEmojiMutation.mutateAsync({
        id: emoji.id,
        emoji: localEmoji.trim(),
        description: localDescription.trim(),
      });
      await utils.emoji.getAllEmojis.invalidate();
      await utils.emoji.getEmojiById.invalidate({ id: emoji.id });
      setIsEditOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  }

  function openEditor() {
    setLocalEmoji(emoji.emoji);
    setLocalDescription(emoji.description);
    setIsEditOpen(true);
  }

  return (
    <>
      <Pressable
        key={emoji.id ?? `${emoji.emoji}-${index}`}
        onPress={() => {
          if (onPress && emoji.id) {
            onPress(emoji.id);
          } else {
            openEditor();
          }
        }}
        className="flex-row items-center p-4 border border-gray-200/50 dark:border-gray-600/50 rounded-xl active:scale-95 transition-transform shadow-sm"
      >
        <View className="bg-white dark:bg-gray-800 rounded-full p-2 mr-4 shadow-sm">
          <Text className="text-2xl leading-7">{emoji.emoji}</Text>
        </View>
        <ThemedText className="flex-1 text-base font-medium">
          {emoji.description}
        </ThemedText>
      </Pressable>

      <Modal
        visible={isEditOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsEditOpen(false)}
      >
        <View
          style={{
            paddingTop: insets.top,
          }}
          className="flex-1 items-center px-4 bg-black/90 backdrop-blur-sm"
        >
          <Card className="w-11/12 max-w-md mx-4">
            <View className="p-6">
              <ThemedText className="text-2xl font-bold mb-2 text-center">
                Edit Emoji
              </ThemedText>
              <ThemedText className="text-sm opacity-70 text-center mb-6">
                Update emoji and description
              </ThemedText>

              <View className="items-center mb-6">
                <Pressable
                  onPress={() => setIsEmojiPickerOpen(true)}
                  className="rounded-2xl p-6 border border-gray-200/50 dark:border-gray-600/50 active:scale-95 transition-transform"
                >
                  <Text className="text-6xl leading-[72px] mb-2">
                    {localEmoji || "😀"}
                  </Text>
                </Pressable>
                <ThemedText className="opacity-70 mt-3 text-center">
                  Tap emoji to choose
                </ThemedText>
              </View>

              <ThemedText className="font-semibold mb-2">
                Description
              </ThemedText>
              <ThemedTextInput
                value={localDescription}
                onChangeText={setLocalDescription}
                placeholder=""
                maxLength={100}
                className="w-full border border-gray-300/50 dark:border-gray-600/50 rounded-xl px-4 py-3 mb-6 bg-white dark:bg-gray-800"
              />

              <View className="flex-row justify-end gap-3">
                <Button type="danger" onPress={() => setIsEditOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="primary"
                  onPress={handleSave}
                  disabled={!canSubmit}
                  style={{ opacity: canSubmit ? 1 : 0.5 }}
                >
                  {isSubmitting ? "Saving..." : "Save"}
                </Button>
              </View>

              <EmojiPicker
                open={isEmojiPickerOpen}
                onClose={() => setIsEmojiPickerOpen(false)}
                onEmojiSelected={(e) => {
                  setLocalEmoji(e.emoji);
                  setIsEmojiPickerOpen(false);
                }}
                theme={emojiTheme}
                categoryPosition="top"
              />
            </View>
          </Card>
        </View>
      </Modal>
    </>
  );
}
