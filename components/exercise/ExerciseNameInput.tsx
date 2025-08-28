import { trpc } from "@/lib/trpc";
import { ExerciseNameListSchema } from "@/types/types";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React, { useEffect, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { z } from "zod";
import exerciseNames from "../../types/exercise_names_master.json";
import { ThemedText } from "../ThemedText";
import { ThemedTextInput } from "../ThemedTextInput";

export default function ExerciseNameInput({
  title,
  setTitle,
}: {
  title: string;
  setTitle: (title: string) => void;
}) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionsFromPrevios, setSuggestionsFromPrevios] = useState<
    string[]
  >([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  type ExerciseNameList = z.infer<typeof ExerciseNameListSchema>;
  const { data } = trpc.fitness.getAllExerciseNames.useQuery() as {
    data: { names: ExerciseNameList[] } | undefined;
  };

  const utils = trpc.useUtils();

  const deleteExerciseNameMutation =
    trpc.fitness.deleteExerciseName.useMutation();

  useEffect(() => {
    if (title.trim().length > 0) {
      // Ensure names is an array before calling map
      const previousExerciseNames = Array.isArray(data?.names)
        ? data.names.map((item) => item.name)
        : [];

      // Filter from master exercise names
      const filtered = exerciseNames.filter((name) =>
        name.toLowerCase().includes(title.toLowerCase())
      ); // Take first 8 from master list

      // Filter from previous exercise names
      const previousExercisesNamesFiltered = previousExerciseNames
        .filter((name: string) =>
          name.toLowerCase().includes(title.toLowerCase())
        )
        .slice(0, 8); // Take first 8 from previous exercises

      setSuggestions(filtered);
      setSuggestionsFromPrevios(previousExercisesNamesFiltered);
      setShowSuggestions(
        filtered.length > 0 || previousExercisesNamesFiltered.length > 0
      );
    } else {
      setSuggestions([]);
      setSuggestionsFromPrevios([]);
      setShowSuggestions(false);
    }
  }, [title, data]);

  const handleSuggestionPress = (suggestion: string) => {
    setTitle(suggestion.toUpperCase());
    setShowSuggestions(false);
    Keyboard.dismiss();
  };

  const handleInputFocus = () => {
    if (
      title.trim().length > 0 &&
      (suggestions.length > 0 || suggestionsFromPrevios.length > 0)
    ) {
      setShowSuggestions(true);
    }
  };

  const handleInputBlur = () => {
    // Delay hiding suggestions to allow for touch events
    setTimeout(() => setShowSuggestions(false), 150);
  };

  const dismissSuggestions = () => {
    setShowSuggestions(false);
  };

  const handleSuggestionDeletion = (suggestion: string) => {
    try {
      // Optimistically update UI
      setSuggestionsFromPrevios((prev) => prev.filter((n) => n !== suggestion));
      // Trigger server mutation and refresh cache when done
      deleteExerciseNameMutation.mutate(
        { name: suggestion },
        {
          onSettled: () => {
            utils.fitness.getAllExerciseNames.invalidate();
          },
        }
      );
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="relative"
    >
      <ThemedTextInput
        value={title}
        onChangeText={setTitle}
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
        className="bg-gray-200 dark:bg-gray-900 p-3 rounded-lg w-full mb-4 text-3xl"
        placeholder="Enter exercise name..."
        autoCapitalize="characters"
        style={{ textTransform: "uppercase" }} // 🔑 immediate uppercase display
      />

      {showSuggestions &&
        (suggestions.length > 0 || suggestionsFromPrevios.length > 0) && (
          <TouchableWithoutFeedback onPress={dismissSuggestions}>
            <View className="absolute top-full left-0 right-0 z-50">
              <View
                className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-48"
                style={{
                  elevation: Platform.OS === "android" ? 10 : 0,
                }}
              >
                <ScrollView
                  className="max-h-48"
                  keyboardShouldPersistTaps="always"
                  nestedScrollEnabled={true}
                  showsVerticalScrollIndicator={false}
                >
                  {suggestionsFromPrevios.map((suggestion, index) => (
                    <TouchableOpacity
                      key={index}
                      onPress={() => handleSuggestionPress(suggestion)}
                      className="px-4 py-3 border-b flex-row justify-between border-gray-200 dark:border-gray-700 last:border-b-0"
                      style={{
                        backgroundColor:
                          index % 2 === 0 ? "rgba(0,0,0,0.02)" : "transparent",
                      }}
                      activeOpacity={0.7}
                    >
                      <ThemedText className="text-lg">
                        {suggestion.toUpperCase()}
                      </ThemedText>
                      <TouchableOpacity
                        onPress={() => handleSuggestionDeletion(suggestion)}
                      >
                        <MaterialIcons name="close" size={20} color="#666" />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}
                  {suggestions.map((suggestion, index) => (
                    <TouchableOpacity
                      key={index}
                      onPress={() =>
                        handleSuggestionPress(suggestion.toUpperCase())
                      }
                      className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 last:border-b-0"
                      style={{
                        backgroundColor:
                          index % 2 === 0 ? "rgba(0,0,0,0.02)" : "transparent",
                      }}
                      activeOpacity={0.7}
                    >
                      <ThemedText className="text-lg">
                        {suggestion.toUpperCase()}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          </TouchableWithoutFeedback>
        )}
    </KeyboardAvoidingView>
  );
}
