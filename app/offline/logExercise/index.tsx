import { Button } from "@/components/Button";
import ExerciseNameInput from "@/components/exercise/ExerciseNameInput";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { saveExerciseToStorage } from "@/lib/offlineStorage";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import { ScrollView, Text, TouchableOpacity } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  Easing,
  FadeInUp,
  LinearTransition,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AddSetCard } from "../../../components/exercise/AddSetCard";

export default function Index() {
  const scrollRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();
  const theme = useColorScheme() ?? "light";

  const [titleError, setTitleError] = useState(false);
  const [title, setTitle] = useState("");
  const [sets, setSets] = useState<
    {
      id: number;
      reps: string;
      value: string;
      setType: "warmup" | "normal" | "failure" | "drop" | "pr" | "failedpr";
    }[]
  >([]);

  const [isLogging, setIsLogging] = useState(false);
  const [measurement, setMeasurement] = useState<
    "kg" | "lbs" | "time" | "distance" | "step"
  >("kg");

  // Track previous length
  const prevLengthRef = useRef(sets.length);

  const addSet = () => {
    const newSet = {
      id: Date.now(),
      reps: "1",
      value: "0",
      setType: "normal" as const,
    };
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

  const updateSetType = (
    id: number,
    newSetType: "warmup" | "normal" | "failure" | "drop" | "pr" | "failedpr"
  ) => {
    setSets((prev) =>
      prev.map((s) => (s.id === id ? { ...s, setType: newSetType } : s))
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
      setIsLogging(true);
      const formattedSets = sets.map(({ value, reps, setType }) => {
        const baseSet = {
          setType: setType,
          measure: measurement,
          value: value || "",
        };

        // Only include reps for kg and lbs measurements
        if (measurement === "kg" || measurement === "lbs") {
          return {
            ...baseSet,
            reps: reps || "",
          };
        }

        return baseSet;
      });

      const payload = {
        date: new Date().toLocaleDateString("en-CA"),
        activity: title.trim().toLowerCase(),
        sets: formattedSets,
      };

      // Save to localStorage with unique ID
      const savedId = await saveExerciseToStorage(payload);
      console.log("Exercise saved to localStorage with ID:", savedId);

      // Navigate using dismiss to close the modal/screen cleanly
      router.dismiss();

      // Reset form state after navigation (won't be visible)
      setTitle("");
      setSets([]);
      setIsLogging(false);
    } catch (error) {
      console.error("Failed to log exercise:", error);
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <ThemedView className="flex-1" style={{ paddingTop: 2 * insets.top }}>
          <ThemedView className="px-4 pb-4">
            {titleError ? (
              <>
                <Text className="text-red-500 mb-2">
                  Please enter an exercise name
                </Text>
                <ExerciseNameInput title={title} setTitle={setTitle} />
              </>
            ) : (
              <ExerciseNameInput title={title} setTitle={setTitle} />
            )}
          </ThemedView>
          <ScrollView
            ref={scrollRef}
            className="flex-1 p-4"
            onContentSizeChange={() => {
              if (sets.length > prevLengthRef.current) {
                scrollRef.current?.scrollToEnd({ animated: true });
              }
              prevLengthRef.current = sets.length;
            }}
          >
            {/* Measurement Selector */}
            <ThemedView className="mb-4">
              <ThemedView className="flex-row space-x-2">
                <TouchableOpacity
                  key={1}
                  activeOpacity={1}
                  onPress={() => setMeasurement("kg")}
                  style={{
                    flex: 1,
                    paddingVertical: 6,
                    paddingHorizontal: 16,
                    borderWidth: 2,
                    borderColor: Colors[theme].highlight,
                    borderTopLeftRadius: 8,
                    borderBottomLeftRadius: 8,
                    backgroundColor:
                      measurement === "kg"
                        ? Colors[theme].highlight
                        : "transparent",
                  }}
                >
                  <ThemedText
                    style={{
                      textAlign: "center",
                      fontWeight: "500",
                      fontSize: 12,
                      color:
                        measurement === "kg"
                          ? Colors[theme].background
                          : Colors[theme].highlight,
                    }}
                  >
                    Kg
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  key={2}
                  activeOpacity={1}
                  onPress={() => setMeasurement("lbs")}
                  style={{
                    flex: 1,
                    paddingVertical: 6,
                    paddingHorizontal: 16,
                    borderWidth: 2,
                    borderColor: Colors[theme].highlight,
                    borderRightWidth: 0,
                    borderLeftWidth: 0,
                    backgroundColor:
                      measurement === "lbs"
                        ? Colors[theme].highlight
                        : "transparent",
                  }}
                >
                  <ThemedText
                    style={{
                      textAlign: "center",
                      fontWeight: "500",
                      fontSize: 12,
                      color:
                        measurement === "lbs"
                          ? Colors[theme].background
                          : Colors[theme].highlight,
                    }}
                  >
                    Lbs
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  key={3}
                  activeOpacity={1}
                  onPress={() => setMeasurement("time")}
                  style={{
                    flex: 1,
                    paddingVertical: 6,
                    paddingHorizontal: 16,

                    borderWidth: 2,
                    borderColor: Colors[theme].highlight,
                    backgroundColor:
                      measurement === "time"
                        ? Colors[theme].highlight
                        : "transparent",
                  }}
                >
                  <ThemedText
                    style={{
                      textAlign: "center",
                      fontWeight: "500",
                      fontSize: 12,
                      color:
                        measurement === "time"
                          ? Colors[theme].background
                          : Colors[theme].highlight,
                    }}
                  >
                    Time
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  key={4}
                  activeOpacity={1}
                  onPress={() => setMeasurement("distance")}
                  style={{
                    flex: 1,
                    paddingVertical: 6,
                    paddingHorizontal: 16,

                    borderWidth: 2,
                    borderColor: Colors[theme].highlight,
                    borderRightWidth: 0,
                    borderLeftWidth: 0,
                    backgroundColor:
                      measurement === "distance"
                        ? Colors[theme].highlight
                        : "transparent",
                  }}
                >
                  <ThemedText
                    style={{
                      textAlign: "center",
                      fontWeight: "500",
                      fontSize: 12,
                      color:
                        measurement === "distance"
                          ? Colors[theme].background
                          : Colors[theme].highlight,
                    }}
                  >
                    Km
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  key={5}
                  activeOpacity={1}
                  onPress={() => setMeasurement("step")}
                  style={{
                    flex: 1,
                    paddingVertical: 6,
                    paddingHorizontal: 16,

                    borderWidth: 2,
                    borderColor: Colors[theme].highlight,
                    borderTopRightRadius: 8,
                    borderBottomRightRadius: 8,
                    backgroundColor:
                      measurement === "step"
                        ? Colors[theme].highlight
                        : "transparent",
                  }}
                >
                  <ThemedText
                    style={{
                      textAlign: "center",
                      fontWeight: "500",
                      fontSize: 12,
                      color:
                        measurement === "step"
                          ? Colors[theme].background
                          : Colors[theme].highlight,
                    }}
                  >
                    Steps
                  </ThemedText>
                </TouchableOpacity>
              </ThemedView>
            </ThemedView>
            <ThemedView className="w-full mb-8">
              {sets.map((set, index) => {
                // Calculate display index - only count normal sets
                const displayIndex =
                  sets.slice(0, index + 1).filter((s) => s.setType === "normal")
                    .length - 1;

                return (
                  <Animated.View
                    key={set.id}
                    layout={LinearTransition}
                    entering={FadeInUp.easing(Easing.out(Easing.cubic))}
                  >
                    <AddSetCard
                      id={set.id}
                      index={displayIndex}
                      reps={set.reps}
                      value={set.value}
                      setType={set.setType}
                      measurement={measurement}
                      onRepsChange={updateReps}
                      onValueChange={updateValue}
                      onSetTypeChange={updateSetType}
                      onRemove={removeSet}
                      onCopy={copySet}
                    />
                  </Animated.View>
                );
              })}

              <Animated.View
                layout={LinearTransition}
                className="flex-row items-start justify-between mt-2"
              >
                <Button onPress={addSet} className="mb-16">
                  + Enter Set
                </Button>
              </Animated.View>
              <Animated.View
                layout={LinearTransition}
                className="items-center justify-between mt-2 mb-16"
              >
                <Button
                  type="primary"
                  onPress={logExercise}
                  disabled={isLogging}
                >
                  {isLogging ? "Logging Exercise..." : "🏋️ Log Exercise"}
                </Button>
              </Animated.View>
            </ThemedView>
          </ScrollView>
        </ThemedView>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}
