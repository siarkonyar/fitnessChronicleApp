import { Button } from "@/components/Button";
import { ThemedText } from "@/components/ThemedText";
import { ThemedTextInput } from "@/components/ThemedTextInput";
import { ThemedView } from "@/components/ThemedView";
import { trpc } from "@/lib/trpc";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import { ScrollView, Text } from "react-native";
import Animated, { FadeInUp, LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AddSetCard } from "../../../components/exercise/AddSetCard";

export default function Index() {
  const scrollRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();
  const addExerciseLogMutation = trpc.fitness.addExerciseLog.useMutation();

  const [titleError, setTitleError] = useState(false);
  const [title, setTitle] = useState("");
  const [sets, setSets] = useState<
    { id: number; reps: string; value: string }[]
  >([]);

  // Track previous length
  const prevLengthRef = useRef(sets.length);

  const addSet = () => {
    const newSet = { id: Date.now(), reps: "10-12", value: "0" };
    setSets((prev) => [...prev, newSet]);
  };

  const removeSet = (id: number) => {
    setSets((prev) => prev.filter((s) => s.id !== id));
  };

  const updateReps = (id: number, newReps: string) => {
    setSets((prev) =>
      prev.map((s) => (s.id === id ? { ...s, reps: newReps } : s))
    );
  };

  const updateValue = (id: number, newValue: string) => {
    setSets((prev) =>
      prev.map((s) => (s.id === id ? { ...s, value: newValue } : s))
    );
  };

  const copySet = (id: number) => {
    setSets((prev) => {
      const setToCopy = prev.find((s) => s.id === id);
      if (!setToCopy) return prev;

      const newSet = { ...setToCopy, id: Date.now() };
      return [...prev, newSet];
    });
  };

  const logExercise = async () => {
    if (!title.trim()) {
      setTitleError(true);
      console.warn("Please enter an exercise name");
      return;
    }

    if (sets.length === 0) {
      console.warn("Add at least one set");
      return;
    }

    try {
      const formattedSets = sets.map(({ value, reps }) => ({
        setType: "kg" as const,
        value: value || "",
        reps: reps || "",
      }));

      const payload = {
        date: new Date().toLocaleDateString("en-CA"),
        activity: title.trim(),
        sets: formattedSets,
      };

      await addExerciseLogMutation.mutateAsync(payload);

      console.log("Exercise logged successfully!", payload);
      router.push("/(tabs)");

      setTitle("");
      setSets([]);
    } catch (error) {
      console.error("Failed to log exercise:", error);
    }
  };

  return (
    <ThemedView className="flex-1">
      <ScrollView
        ref={scrollRef}
        className="flex-1 p-4"
        style={{ paddingTop: 2 * insets.top }}
        onContentSizeChange={() => {
          if (sets.length > prevLengthRef.current) {
            scrollRef.current?.scrollToEnd({ animated: true });
          }
          prevLengthRef.current = sets.length;
        }}
      >
        <ThemedView className="mb-8">
          <ThemedText type="title" className="font-bold mb-4">
            Exercise Name
          </ThemedText>
          {titleError ? (
            <>
              <Text className="text-red-500 mb-2">
                Please enter an exercise name
              </Text>
              <ThemedTextInput
                value={title}
                onChangeText={setTitle}
                className="bg-gray-200 dark:bg-gray-900 border border-red-500 p-3 rounded-lg w-full mb-4 text-3xl"
              />
            </>
          ) : (
            <ThemedTextInput
              value={title}
              onChangeText={setTitle}
              className="bg-gray-200 dark:bg-gray-900 p-3 rounded-lg w-full mb-4 text-3xl"
            />
          )}
        </ThemedView>

        <ThemedView className="w-full mb-8">
          {sets.map((set, index) => (
            <Animated.View
              key={set.id}
              layout={LinearTransition}
              entering={FadeInUp.springify().damping(15)}
            >
              <AddSetCard
                id={set.id}
                index={index}
                reps={set.reps}
                value={set.value}
                onRepsChange={updateReps}
                onValueChange={updateValue}
                onRemove={removeSet}
                onCopy={copySet}
              />
            </Animated.View>
          ))}

          <Animated.View
            layout={LinearTransition}
            className="flex-row items-center justify-between mt-2 mb-8"
          >
            <Button onPress={addSet}>+ Enter Set</Button>
          </Animated.View>
          <Animated.View
            layout={LinearTransition}
            className="flex-1 items-center mt-2 mb-16"
          >
            <Button type="primary" onPress={logExercise}>
              🏋️ Log Exercise
            </Button>
          </Animated.View>
        </ThemedView>
      </ScrollView>
    </ThemedView>
  );
}
