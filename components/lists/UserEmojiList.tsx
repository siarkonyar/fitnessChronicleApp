import { Colors } from "@/constants/Colors";
import { trpc } from "@/lib/trpc";
// import { EmojiSchema } from "@/types/types";
import React from "react";
import { Modal, Pressable, Text, View } from "react-native";
// Using rn-emoji-keyboard which provides a theme API for dark mode
import { useColorScheme } from "@/hooks/useColorScheme";
import EmojiPicker from "rn-emoji-keyboard";
// import { z } from "zod";
import { EmojiWithIdSchema } from "@/types/types";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { z } from "zod";
import { Button } from "../Button";
import Card from "../Card";
import { ThemedText } from "../ThemedText";
import { ThemedTextInput } from "../ThemedTextInput";
import EmojiCard from "../cards/EmojiCard";

export default function UserEmojiList() {
  type emojiScheme = z.infer<typeof EmojiWithIdSchema>;
  const addEmojiMutation = trpc.emoji.addEmoji.useMutation();
  const { data: emojisRaw, isLoading } = trpc.emoji.getAllEmojis.useQuery();
  const utils = trpc.useUtils();
  const insets = useSafeAreaInsets();

  const [isAddEmojiOpen, setIsAddEmojiOpen] = React.useState(false);
  const [emoji, setEmoji] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = React.useState(false);
  const theme = useColorScheme() ?? "light";

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
      await utils.emoji.getAllEmojis.invalidate();
      setIsAddEmojiOpen(false);
      setEmoji("");
      setDescription("");
    } finally {
      setIsSubmitting(false);
    }
  }
  const emojis: emojiScheme[] = Array.isArray(emojisRaw)
    ? (emojisRaw as emojiScheme[])
    : [];

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center py-8">
        <ThemedText className="text-lg text-center opacity-70">
          Loading...
        </ThemedText>
      </View>
    );
  }

  return (
    <>
      <Card>
        <ThemedText className="text-xl font-bold mb-4 text-center">
          Your Emoji Collection
        </ThemedText>

        {emojis.length > 0 ? (
          <View className="flex-col gap-3 mb-6">
            {emojis.map((item, index) => (
              <EmojiCard emoji={item} key={index} index={index} />
            ))}
          </View>
        ) : (
          <View className="items-center py-8 mb-6">
            <Text className="text-5xl mb-3">📝</Text>
            <ThemedText className="text-center opacity-70 mb-2 text-lg">
              No emojis yet
            </ThemedText>
            <ThemedText className="text-sm text-center opacity-50">
              Add your first emoji below to get started
            </ThemedText>
          </View>
        )}
        <Button onPress={() => setIsAddEmojiOpen(true)}>+ Add Emoji</Button>
      </Card>

      <Modal
        visible={isAddEmojiOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsAddEmojiOpen(false)}
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
                Create New Emoji
              </ThemedText>
              <ThemedText className="text-sm opacity-70 text-center mb-6">
                Add a new emoji to your collection
              </ThemedText>

              <View className="items-center mb-6">
                <Pressable
                  onPress={() => setIsEmojiPickerOpen(true)}
                  className="rounded-2xl p-6 border border-gray-200/50 dark:border-gray-600/50 active:scale-95 transition-transform"
                >
                  <Text className="text-6xl leading-[72px] mb-2">
                    {emoji || "😀"}
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
                value={description}
                onChangeText={setDescription}
                placeholder=""
                maxLength={100}
                className="w-full border border-gray-300/50 dark:border-gray-600/50 rounded-xl px-4 py-3 mb-6 bg-white dark:bg-gray-800"
              />

              <View className="flex-row justify-end gap-3">
                <Button type="danger" onPress={() => setIsAddEmojiOpen(false)}>
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

              {/* TODO: searchbar is at the bottom. either change the package or find a way to put it on top */}
              <EmojiPicker
                open={isEmojiPickerOpen}
                onClose={() => setIsEmojiPickerOpen(false)}
                onEmojiSelected={(e) => {
                  setEmoji(e.emoji);
                  setIsEmojiPickerOpen(false);
                }}
                theme={emojiTheme}
                //enableSearchBar
                categoryPosition="top"
              />
            </View>
          </Card>
        </View>
      </Modal>
    </>
  );
}
