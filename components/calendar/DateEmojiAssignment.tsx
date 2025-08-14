import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import { trpc } from "@/lib/trpc";
import { EmojiSchema, EmojiWithIdSchema } from "@/types/types";
import React from "react";
import {
  ActivityIndicator,
  Modal,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { z } from "zod";
import { Button } from "../Button";
import Card from "../Card";
import { ThemedView } from "../ThemedView";
import EmojiCard from "../cards/EmojiCard";

// Represents an emoji assignment joined with its emoji data
export type DateEmojiAssignmentWithEmoji = {
  id: string;
  date: string; // ISO string (e.g., 2025-08-12)
  emojiId: string;
  emoji: typeof EmojiSchema;
};

export default function DateEmojiAssignment({
  selectedDate,
}: {
  selectedDate: string;
}) {
  const theme = useColorScheme() ?? "light";

  type Emoji = z.infer<typeof EmojiSchema>;
  type EmojiWithID = z.infer<typeof EmojiWithIdSchema>;

  const { data, isLoading } = trpc.emoji.getEmojiAsignmentByDate.useQuery({
    date: selectedDate,
  }) as {
    data: DateEmojiAssignmentWithEmoji | undefined;
    isLoading: boolean;
  };
  const emojiId = data?.emojiId;
  const { data: emoji, isLoading: emojisLoading } =
    trpc.emoji.getEmojiById.useQuery(
      { id: emojiId ?? "" },
      { enabled: !!emojiId }
    ) as {
      data: Emoji | undefined;
      isLoading: boolean;
    };

  const asignEmojiToDayMutation = trpc.emoji.asignEmojiToDay.useMutation();
  const deleteAssignedEmojiMutation = trpc.emoji.deleteAssignment.useMutation();
  const utils = trpc.useUtils();
  const { data: emojisRaw } = trpc.emoji.getAllEmojis.useQuery();
  const [isEmojiSelectionOpen, setIsEmojiSelectionOpen] = React.useState(false);
  const [isAssigningEmoji, setIsAssigningEmoji] = React.useState(false);

  //TODO: after clicking on an emoji it shows the loading screen but right after that for a split second it shows the card again. it happens so fast but it is still annoying to see
  async function handleAsignEmojiToDay(emojiId: string) {
    try {
      setIsAssigningEmoji(true);
      await asignEmojiToDayMutation.mutateAsync({
        date: selectedDate,
        emojiId: emojiId,
      });
      // Invalidate relevant queries to refresh the data
      await utils.emoji.getEmojiAsignmentByDate.invalidate({
        date: selectedDate,
      });
      // Also invalidate the calendar query to refresh emoji display
      await utils.emoji.getAllEmojisFromMonth.invalidate({
        date: selectedDate.slice(0, 7), // Get the month part (YYYY-MM)
      });

      setIsAssigningEmoji(false);
      setIsEmojiSelectionOpen(false);
    } catch (error) {
      console.error("Failed to assign emoji to day:", error);
      setIsAssigningEmoji(false);
    }
  }
  async function handleDeleteAssignedEmoji(date: string) {
    try {
      setIsAssigningEmoji(true);
      await deleteAssignedEmojiMutation.mutateAsync({
        date: selectedDate,
      });
      // Invalidate relevant queries to refresh the data
      await utils.emoji.getEmojiAsignmentByDate.invalidate({
        date: selectedDate,
      });
      // Also invalidate the calendar query to refresh emoji display
      await utils.emoji.getAllEmojisFromMonth.invalidate({
        date: selectedDate.slice(0, 7), // Get the month part (YYYY-MM)
      });

      setIsAssigningEmoji(false);
      setIsEmojiSelectionOpen(false);
    } catch (error) {
      console.error("Failed to delete emoji assignment:", error);
      setIsAssigningEmoji(false);
    }
  }

  const emojis: EmojiWithID[] = Array.isArray(emojisRaw)
    ? (emojisRaw as EmojiWithID[])
    : [];

  if (isLoading || emojisLoading) {
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
      <ThemedView>
        {data && emoji ? (
          <TouchableOpacity
            className="rounded-2xl p-6 mb-2 shadow-sm border border-gray-200/50 dark:border-gray-700/50 active:scale-95 transition-transform"
            onPress={() => setIsEmojiSelectionOpen(true)}
          >
            <View className="flex-col items-center justify-center space-x-3">
              <Text className="text-4xl leading-11">{emoji.emoji}</Text>
              <ThemedText className="text-lg font-medium text-center text-gray-700 dark:text-gray-200">
                {emoji.description}
              </ThemedText>
            </View>
            <ThemedText className="text-xs text-center mt-2 opacity-60">
              Tap to change
            </ThemedText>
          </TouchableOpacity>
        ) : (
          <Button onPress={() => setIsEmojiSelectionOpen(true)}>
            Assign an Emoji to This Day
          </Button>
        )}
      </ThemedView>

      <Modal
        visible={isEmojiSelectionOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsEmojiSelectionOpen(false)}
      >
        <View className="flex-1 items-center justify-center px-4 bg-black/90 backdrop-blur-sm">
          {isAssigningEmoji ? (
            <ActivityIndicator
              size="large"
              color={Colors[theme].highlight}
              className="mb-4"
            />
          ) : (
            <Card className="w-11/12 max-w-md mx-4">
              <View className="p-6">
                <ThemedText className="text-2xl font-bold mb-2 text-center">
                  Choose What You Hit!
                </ThemedText>
                <ThemedText className="text-sm opacity-70 text-center mb-6">
                  {selectedDate}
                </ThemedText>

                {emojis.length > 0 ? (
                  <View className="flex-col gap-3 mb-6">
                    {emojis.map((item, index) => (
                      <EmojiCard
                        emoji={item}
                        index={index}
                        key={index}
                        onPress={handleAsignEmojiToDay}
                      />
                    ))}
                    {data && (
                      <Button
                        type="danger"
                        onPress={async () => {
                          handleDeleteAssignedEmoji(selectedDate);
                        }}
                      >
                        Remove Emoji Assignment
                      </Button>
                    )}
                  </View>
                ) : (
                  <View className="items-center py-8">
                    <Text className="text-4xl mb-3">😔</Text>
                    <ThemedText className="text-center opacity-70 mb-2">
                      No emojis available
                    </ThemedText>
                    <ThemedText className="text-sm text-center opacity-50">
                      Please add some emojis first
                    </ThemedText>
                  </View>
                )}

                <Button onPress={() => setIsEmojiSelectionOpen(false)}>
                  Cancel
                </Button>
              </View>
            </Card>
          )}
        </View>
      </Modal>
    </>
  );
}
