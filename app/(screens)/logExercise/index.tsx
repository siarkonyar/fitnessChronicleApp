import { Button } from "@/components/Button";
import ExerciseNameInput from "@/components/exercise/ExerciseNameInput";
import GetExerciseCard from "@/components/exercise/GetExerciseCard";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useServerErrorHandler } from "@/hooks/useServerErrorHandler";
import { formatDateAsString } from "@/lib/dateUtils";
import { trpc } from "@/lib/trpc";
import { ExerciseLogWithIdSchema } from "@/types/types";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { ScrollView, Text, TouchableOpacity } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  Easing,
  FadeInUp,
  LinearTransition,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { z } from "zod";
import { AddSetCard } from "../../../components/exercise/AddSetCard";

export default function Index() {
  const scrollRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();
  const theme = useColorScheme() ?? "light";
  const { handleQueryError, handleMutationError } = useServerErrorHandler();
  const addExerciseLogMutation = trpc.fitness.addExerciseLog.useMutation({
    onError: (error) => {
      handleMutationError(error);
    },
  });
  const utils = trpc.useUtils();

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
    "kg" | "lbs" | "time" | "distance" | "steps"
  >("kg");

  // Track previous length
  const prevLengthRef = useRef(sets.length);

  const handleMeasurementChange = (
    newMeasurement: "kg" | "lbs" | "time" | "distance" | "steps"
  ) => {
    if (newMeasurement !== measurement) {
      setSets([]); // Reset sets only when measurement actually changes
    }
    setMeasurement(newMeasurement);
  };

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
        // Create the correct object structure based on measurement type
        switch (measurement) {
          case "kg":
            return {
              measure: "kg" as const,
              setType: setType,
              value: value || "",
              reps: reps || "",
            };
          case "lbs":
            return {
              measure: "lbs" as const,
              setType: setType,
              value: value || "",
              reps: reps || "",
            };
          case "time":
            return {
              measure: "time" as const,
              setType: setType as "warmup" | "normal" | "failure" | "pr",
              value: value || "",
            };
          case "distance":
            return {
              measure: "distance" as const,
              setType: setType as "warmup" | "normal" | "failure" | "pr",
              value: value || "",
            };
          case "steps":
            return {
              measure: "steps" as const,
              setType: setType as "warmup" | "normal" | "failure" | "pr",
              value: value || "",
            };
          default:
            // Fallback (should never reach here)
            return {
              measure: "kg" as const,
              setType: setType,
              value: value || "",
              reps: reps || "",
            };
        }
      });

      const payload = {
        date: new Date().toLocaleDateString("en-CA"),
        activity: title.trim().toLowerCase(),
        sets: formattedSets,
      };

      await addExerciseLogMutation.mutateAsync(payload);

      await utils.fitness.getExerciseLogByDate.invalidate({
        date: payload.date,
      });
      await utils.fitness.getExerciseLogsByMonth.invalidate({
        month: payload.date.slice(0, 7),
      });

      console.log("Exercise logged successfully!", payload);
      router.push("/(tabs)");

      setTitle("");
      setSets([]);
      setIsLogging(false);
    } catch (error) {
      console.error("Failed to log exercise:", error);
    }
  };

  type ExerciseLog = z.infer<typeof ExerciseLogWithIdSchema>;
  const {
    data: previousExercises,
    isLoading,
    error,
  } = trpc.fitness.getLatestExercisesByName.useQuery(
    {
      name: title.trim().toLowerCase(),
    },
    {
      enabled: title.trim().length > 0,
      retry: false,
    }
  ) as {
    data: ExerciseLog[] | undefined;
    isLoading: boolean;
    error: any;
  };

  const sortedPreviousExercises = React.useMemo(() => {
    if (!previousExercises) return [] as ExerciseLog[];
    return [...previousExercises].sort((a, b) => b.date.localeCompare(a.date));
  }, [previousExercises]);

  useEffect(() => {
    if (error) {
      handleQueryError(error);
    }
  }, [error, handleQueryError]);

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
            nestedScrollEnabled
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
                  onPress={() => handleMeasurementChange("kg")}
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
                  onPress={() => handleMeasurementChange("lbs")}
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
                  onPress={() => handleMeasurementChange("time")}
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
                  onPress={() => handleMeasurementChange("distance")}
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
                  onPress={() => handleMeasurementChange("steps")}
                  style={{
                    flex: 1,
                    paddingVertical: 6,
                    paddingHorizontal: 16,

                    borderWidth: 2,
                    borderColor: Colors[theme].highlight,
                    borderTopRightRadius: 8,
                    borderBottomRightRadius: 8,
                    backgroundColor:
                      measurement === "steps"
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
                        measurement === "steps"
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
                <Button onPress={addSet} className="mb-12">
                  + Enter Set
                </Button>
              </Animated.View>
              <Animated.View
                layout={LinearTransition}
                className="items-center justify-between mb-16"
              >
                <Button
                  type="primary"
                  onPress={logExercise}
                  disabled={isLogging}
                >
                  {isLogging ? "Logging Exercise..." : "🏋️ Log Exercise"}
                </Button>
              </Animated.View>
              {title.trim().length > 0 && (
                <Animated.View
                  layout={LinearTransition}
                  className="items-center justify-between mt-2 mb-16"
                >
                  <ThemedText type="title" className="font-bold mb-8">
                    Previous sessions
                  </ThemedText>
                  {isLoading ? (
                    <ThemedText className="text-gray-500">
                      Loading...
                    </ThemedText>
                  ) : error ? (
                    <ThemedText className="text-gray-500">
                      No previous exercise found
                    </ThemedText>
                  ) : sortedPreviousExercises.length > 0 ? (
                    sortedPreviousExercises.slice(0, 4).map((exercise, idx) => (
                      <React.Fragment key={exercise.id}>
                        <ThemedView className="flex-col items-end">
                          <ThemedText
                            lightColor={Colors.light.mutedText}
                            darkColor={Colors.dark.mutedText}
                            className="text-sm mb-2"
                          >
                            {formatDateAsString(exercise.date)}
                          </ThemedText>
                          <GetExerciseCard exercise={exercise} index={idx} />
                        </ThemedView>
                      </React.Fragment>
                    ))
                  ) : (
                    <ThemedText className="text-gray-500">
                      No previous exercise found
                    </ThemedText>
                  )}
                </Animated.View>
              )}
            </ThemedView>
          </ScrollView>
        </ThemedView>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}
