import { Button } from "@/components/Button";
import ExerciseNameInput from "@/components/exercise/ExerciseNameInput";
import GetExerciseCard from "@/components/exercise/GetExerciseCard";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Colors } from "@/constants/Colors";
import { queryKeys } from "@/constants/QueryKeys";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useServerErrorHandler } from "@/hooks/useServerErrorHandler";
import { formatDateAsString } from "@/lib/dateUtils";
import {
  addExerciseLog,
  getLatestExercisesByName,
} from "@/lib/firebase/exercise";
import { getDefaultMeasurement, getDefaultRepType } from "@/lib/offlineStorage";
import { ExerciseLogWithIdSchema } from "@/types/types";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { LinearTransition } from "react-native-reanimated";
import { z } from "zod";
import { AddSetCard } from "../../../components/exercise/AddSetCard";

export default function Index() {
  const scrollRef = useRef<ScrollView>(null);
  const theme = useColorScheme() ?? "light";
  const queryClient = useQueryClient();
  const { handleQueryError, handleMutationError } = useServerErrorHandler();
  const { copyActivity, copySets } = useLocalSearchParams<{
    copyActivity?: string;
    copySets?: string;
  }>();

  const addExerciseLogMutation = useMutation({
    mutationFn: addExerciseLog,
    onError: (error) => {
      handleMutationError(error);
    },
    onSuccess: (data, variables) => {
      // Invalidate queries to refetch data
      queryClient.invalidateQueries({
        queryKey: queryKeys.exerciseLogs.byDate(variables.date),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.exerciseLogs.byMonth(variables.date.slice(0, 7)),
      });
    },
  });

  const [titleError, setTitleError] = useState(false);
  const [title, setTitle] = useState(copyActivity ?? "");
  const [sets, setSets] = useState<
    {
      id: number;
      reps: string;
      value: string;
      setType: "warmup" | "normal" | "failure" | "drop" | "pr" | "failedpr";
    }[]
  >(() => {
    if (!copySets) return [];
    try {
      const parsed = JSON.parse(copySets) as {
        measure: string;
        setType: "warmup" | "normal" | "failure" | "drop" | "pr" | "failedpr";
        value?: string;
        reps?: string;
      }[];
      return parsed.map((s, i) => ({
        id: Date.now() + i,
        reps: s.reps ?? "1",
        value: s.value ?? "0",
        setType: s.setType ?? "normal",
      }));
    } catch {
      return [];
    }
  });
  const [isRepsFixed, setIsRepsFixed] = useState(false);

  useEffect(() => {
    getDefaultRepType().then(setIsRepsFixed);
    if (!copySets) {
      getDefaultMeasurement().then(setMeasurement);
    }
  }, [copySets]);

  const [isLogging, setIsLogging] = useState(false);
  const [measurement, setMeasurement] = useState<
    "kg" | "lbs" | "time" | "distance" | "steps"
  >(() => {
    if (!copySets) return "kg";
    try {
      const parsed = JSON.parse(copySets) as { measure: string }[];
      const m = parsed[0]?.measure;
      if (
        m === "kg" ||
        m === "lbs" ||
        m === "time" ||
        m === "distance" ||
        m === "steps"
      )
        return m;
    } catch {
      // fall through
    }
    return "kg";
  });

  // Track previous length
  const prevLengthRef = useRef(sets.length);

  const handleMeasurementChange = (
    newMeasurement: "kg" | "lbs" | "time" | "distance" | "steps",
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
    Keyboard.dismiss();
    setSets((prev) => prev.filter((s) => s.id !== id));
  };

  const updateReps = (id: number, newReps: string) => {
    setSets((prev) =>
      prev.map((s) => (s.id === id ? { ...s, reps: newReps } : s)),
    );
  };

  const updateValue = (id: number, newValue: string) => {
    setSets((prev) =>
      prev.map((s) => (s.id === id ? { ...s, value: newValue } : s)),
    );
  };

  const updateSetType = (
    id: number,
    newSetType: "warmup" | "normal" | "failure" | "drop" | "pr" | "failedpr",
  ) => {
    setSets((prev) =>
      prev.map((s) => (s.id === id ? { ...s, setType: newSetType } : s)),
    );
  };

  const copySet = (id: number) => {
    Keyboard.dismiss();
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
  } = useQuery({
    queryKey: queryKeys.latestExercises.byName(title.trim().toLowerCase()),
    queryFn: () => getLatestExercisesByName(title.trim().toLowerCase()),
    enabled: title.trim().length > 0,
  });

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
        <ThemedView className="flex-1">
          <ThemedView className="px-4 my-4">
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
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={-50}
          >
            <ScrollView
              ref={scrollRef}
              className="flex-1 p-4"
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              onContentSizeChange={() => {
                /* if (sets.length > prevLengthRef.current) {
                scrollRef.current?.scrollToEnd({ animated: true });
              } */
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
                      /* borderRightWidth: 0,
                    borderLeftWidth: 0, */
                      borderTopRightRadius: 8,
                      borderBottomRightRadius: 8,
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
                </ThemedView>
              </ThemedView>
              <ThemedView className="w-full mb-8">
                {sets.map((set, index) => {
                  // Calculate display index - only count normal sets
                  const displayIndex =
                    sets
                      .slice(0, index + 1)
                      .filter((s) => s.setType === "normal").length - 1;

                  return (
                    <View key={set.id}>
                      <AddSetCard
                        id={set.id}
                        index={displayIndex}
                        reps={set.reps}
                        value={set.value}
                        setType={set.setType}
                        measurement={measurement}
                        repType={isRepsFixed ? "fixed" : "range"}
                        onRepsChange={updateReps}
                        onValueChange={updateValue}
                        onSetTypeChange={updateSetType}
                        onRemove={removeSet}
                        onCopy={copySet}
                      />
                    </View>
                  );
                })}

                <View className="flex-row items-start justify-between mt-2">
                  <Button onPress={addSet} className="mb-12">
                    + Enter Set
                  </Button>
                </View>
                <Animated.View
                  layout={LinearTransition}
                  className="items-center justify-between mb-16"
                >
                  <Button
                    type="primary"
                    onPress={logExercise}
                    disabled={isLogging}
                  >
                    {isLogging ? "Logging Exercise..." : "Log Exercise"}
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
                      sortedPreviousExercises
                        .slice(0, 4)
                        .map((exercise, idx) => (
                          <React.Fragment key={exercise.id}>
                            <ThemedView className="flex-col items-end w-full">
                              <ThemedText
                                lightColor={Colors.light.mutedText}
                                darkColor={Colors.dark.mutedText}
                                className="mb-2"
                              >
                                {formatDateAsString(exercise.date)}
                              </ThemedText>
                              <GetExerciseCard
                                exercise={exercise}
                                index={idx}
                                copyable
                              />
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
          </KeyboardAvoidingView>
        </ThemedView>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}
