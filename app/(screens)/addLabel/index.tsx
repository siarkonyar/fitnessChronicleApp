import { Button } from "@/components/Button";
import { ThemedText } from "@/components/ThemedText";
import { ThemedTextInput } from "@/components/ThemedTextInput";
import { ThemedView } from "@/components/ThemedView";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useServerErrorHandler } from "@/hooks/useServerErrorHandler";
import { trpc } from "@/lib/trpc";
import { router } from "expo-router";
import React, { useState } from "react";
import { ScrollView, View } from "react-native";
import Animated, { LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function Index() {
  const insets = useSafeAreaInsets();
  const { handleMutationError } = useServerErrorHandler();
  const addLabelMutation = trpc.label.addLabel.useMutation({
    onError: (error) => {
      handleMutationError(error);
    },
  });
  const utils = trpc.useUtils();
  const theme = useColorScheme() ?? "light";

  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit =
    label.trim().length > 0 && description.trim().length > 0 && !isSubmitting;

  async function handleAddLabel() {
    if (!canSubmit) return;
    try {
      setIsSubmitting(true);
      await addLabelMutation.mutateAsync({
        label: label.trim(),
        description: description.trim(),
        dates: [] as string[],
      });
      await utils.label.getAllLabels.invalidate();
      setLabel("");
      setDescription("");
      router.push("/(tabs)/settings");
    } catch (error) {
      console.log(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ThemedView className="flex-1" style={{ paddingTop: 2 * insets.top }}>
      <ScrollView className="flex-1 p-4">
        <View className="p-6">
          <ThemedText className="text-2xl font-bold mb-2 text-center">
            Create New Label
          </ThemedText>
          <ThemedText className="text-sm opacity-70 text-center mb-6">
            Add a new label to your collection
          </ThemedText>

          <View className="items-center mb-6">
            <ThemedTextInput
              value={label}
              onChangeText={(t) => {
                const chars = Array.from(t);
                const last = chars[chars.length - 1] ?? "";
                setLabel(last.toUpperCase());
              }}
              maxLength={1}
              caretHidden
              onKeyPress={({ nativeEvent: { key } }) => {
                if (key === "Backspace") return setLabel("");
                if (/[\p{L}\p{N}]/u.test(key) || /\p{Extended_Pictographic}/u.test(key)) {
                  setLabel(key.toUpperCase());
                }
              }}
              autoCapitalize="characters"
              placeholder=""
              className="w-[56px] h-[56px] border border-gray-300/50 dark:border-gray-600/50 rounded-xl mb-6 bg-white dark:bg-gray-800"
              style={{
                textAlign: "center",
                textAlignVertical: "center" as any,
                paddingTop: 0,
                paddingBottom: 0,
                fontSize: 28,
                textTransform: "uppercase",
              }}
            />
            <ThemedText className="opacity-70 mt-3 text-center">
              Tap label to choose
            </ThemedText>
          </View>

          <ThemedText className="font-semibold mb-2">Description</ThemedText>
          <ThemedTextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Enter label description..."
            maxLength={100}
            className="w-full border border-gray-300/50 dark:border-gray-600/50 rounded-xl px-4 py-3 mb-6 bg-white dark:bg-gray-800"
          />

          <Animated.View
            layout={LinearTransition}
            className="flex-row justify-end gap-3"
          >
            <Button
              type="primary"
              onPress={handleAddLabel}
              disabled={!canSubmit}
              style={{ opacity: canSubmit ? 1 : 0.5 }}
            >
              {isSubmitting ? "Adding..." : "Add Label"}
            </Button>
          </Animated.View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}
