import AppTextInput from "@/components/ui/AppTextInput";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { queryKeys } from "@/constants/QueryKeys";
import { useServerErrorHandler } from "@/hooks/useServerErrorHandler";
import {
  deleteExerciseName,
  getAllExerciseNames,
} from "@/lib/firebase/exercise";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import exerciseNames from "../../types/exercise_names_master.json";
import { ThemedText } from "../ThemedText";

export default function ExerciseNameInput({
  title,
  setTitle,
}: {
  title: string;
  setTitle: (title: string) => void;
}) {
  const theme = useColorScheme() ?? "light";
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionsFromPrevios, setSuggestionsFromPrevios] = useState<
    string[]
  >([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);

  const queryClient = useQueryClient();
  const { handleMutationError } = useServerErrorHandler();

  const { data } = useQuery({
    queryKey: queryKeys.exerciseNames.all,
    queryFn: () => getAllExerciseNames(),
  });

  const deleteExerciseNameMutation = useMutation({
    mutationFn: deleteExerciseName,
    onError: (error) => {
      handleMutationError(error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.exerciseNames.all,
      });
    },
  });

  useEffect(() => {
    if (title.trim().length > 0) {
      const previousExerciseNames = Array.isArray(data)
        ? data.map((item) => item.name)
        : [];

      const filtered = exerciseNames
        .filter((name) => name.toLowerCase().includes(title.toLowerCase()))
        .sort((a, b) => a.length - b.length || a.localeCompare(b))
        .slice(0, 8);

      const previousExercisesNamesFiltered = previousExerciseNames
        .filter((name: string) =>
          name.toLowerCase().includes(title.toLowerCase()),
        )
        .sort((a, b) => a.length - b.length || a.localeCompare(b))
        .slice(0, 8);

      setSuggestions(filtered);
      setSuggestionsFromPrevios(previousExercisesNamesFiltered);
      setShowSuggestions(
        isInputFocused &&
          (filtered.length > 0 || previousExercisesNamesFiltered.length > 0),
      );
    } else {
      setSuggestions([]);
      setSuggestionsFromPrevios([]);
      setShowSuggestions(false);
    }
  }, [title, data, isInputFocused]);

  const handleSuggestionPress = (suggestion: string) => {
    setTitle(suggestion.toUpperCase());
    setShowSuggestions(false);
    Keyboard.dismiss();
  };

  const handleInputFocus = () => {
    setIsInputFocused(true);
    if (
      title.trim().length > 0 &&
      (suggestions.length > 0 || suggestionsFromPrevios.length > 0)
    ) {
      setShowSuggestions(true);
    }
  };

  const handleInputBlur = () => {
    setIsInputFocused(false);
    setTimeout(() => setShowSuggestions(false), 150);
  };

  const dismissSuggestions = () => {
    setShowSuggestions(false);
  };

  const handleSuggestionDeletion = (suggestion: string) => {
    setSuggestionsFromPrevios((prev) => prev.filter((n) => n !== suggestion));
    deleteExerciseNameMutation.mutate(suggestion);
  };

  const hasPrevious = suggestionsFromPrevios.length > 0;
  const hasMasterSuggestions = suggestions.length > 0;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="relative"
    >
      <AppTextInput
        value={title}
        onChangeText={setTitle}
        onFocus={handleInputFocus}
        autoFocus={false}
        onBlur={handleInputBlur}
        className="w-full text-3xl font-semibold"
        style={{ textTransform: "uppercase" }}
        placeholder="Exercise name..."
        autoCapitalize="characters"
      />

      {showSuggestions && (hasPrevious || hasMasterSuggestions) && (
        <TouchableWithoutFeedback onPress={dismissSuggestions}>
          <View className="absolute top-full left-0 right-0 z-50 mt-1">
            <View
              style={{
                backgroundColor: Colors[theme].cardBackground,
                borderWidth: 1,
                borderColor: Colors[theme].cardBorderColor,
                borderRadius: 12,
                maxHeight: 192,
                elevation: Platform.OS === "android" ? 10 : 0,
                overflow: "hidden",
              }}
            >
              <ScrollView
                className="max-h-48"
                keyboardShouldPersistTaps="always"
                nestedScrollEnabled={true}
                showsVerticalScrollIndicator={false}
              >
                {hasPrevious && (
                  <>
                    <ThemedText
                      className="px-4 pt-3 pb-1 font-bold tracking-widest"
                      style={{ color: Colors[theme].mutedText }}
                    >
                      MY EXERCISES
                    </ThemedText>
                    {suggestionsFromPrevios.map((suggestion, index) => (
                      <TouchableOpacity
                        key={index}
                        onPress={() => handleSuggestionPress(suggestion)}
                        className="px-4 py-3 flex-row justify-between items-center"
                        style={{
                          borderBottomWidth: 1,
                          borderBottomColor: Colors[theme].separator,
                        }}
                        activeOpacity={0.7}
                      >
                        <ThemedText
                          className="text-base font-medium flex-1 mr-3"
                          style={{ color: Colors[theme].text }}
                        >
                          {suggestion.toUpperCase()}
                        </ThemedText>
                        <TouchableOpacity
                          onPress={() => handleSuggestionDeletion(suggestion)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <MaterialIcons
                            name="close"
                            size={16}
                            color={Colors[theme].mutedText}
                          />
                        </TouchableOpacity>
                      </TouchableOpacity>
                    ))}
                  </>
                )}

                {hasMasterSuggestions && (
                  <>
                    {hasPrevious && (
                      <ThemedText
                        className="px-4 pt-3 pb-1 font-bold tracking-widest"
                        style={{ color: Colors[theme].mutedText }}
                      >
                        SUGGESTIONS
                      </ThemedText>
                    )}
                    {suggestions.map((suggestion, index) => (
                      <TouchableOpacity
                        key={index}
                        onPress={() =>
                          handleSuggestionPress(suggestion.toUpperCase())
                        }
                        className="px-4 py-3"
                        style={{
                          borderBottomWidth:
                            index < suggestions.length - 1 ? 1 : 0,
                          borderBottomColor: Colors[theme].separator,
                        }}
                        activeOpacity={0.7}
                      >
                        <ThemedText
                          className="text-base"
                          style={{ color: Colors[theme].text }}
                        >
                          {suggestion.toUpperCase()}
                        </ThemedText>
                      </TouchableOpacity>
                    ))}
                  </>
                )}
              </ScrollView>
            </View>
          </View>
        </TouchableWithoutFeedback>
      )}
    </KeyboardAvoidingView>
  );
}
