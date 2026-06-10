import Card from "@/components/Card";
import ProgramCard from "@/components/cards/ProgramCard";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Colors } from "@/constants/Colors";
import { queryKeys } from "@/constants/QueryKeys";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useServerErrorHandler } from "@/hooks/useServerErrorHandler";
import { deleteProgram, getPrograms } from "@/lib/firebase/program";
import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import React, { useEffect } from "react";
import { Alert, ScrollView, View } from "react-native";
import { Button } from "../Button";

export default function ProgramList() {
  const theme = useColorScheme() ?? "light";
  const queryClient = useQueryClient();
  const { handleQueryError, handleMutationError } = useServerErrorHandler();

  const {
    data: programs,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.programs.all,
    queryFn: () => getPrograms(),
  });

  useEffect(() => {
    if (error) handleQueryError(error);
  }, [error, handleQueryError]);

  const deleteProgramMutation = useMutation({
    mutationFn: (id: string) => deleteProgram(id),
    onError: (error) => {
      handleMutationError(error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.programs.all });
    },
  });

  function handleDeleteProgram(id: string) {
    Alert.alert(
      "Delete Program",
      "Are you sure you want to delete this program?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteProgramMutation.mutate(id),
        },
      ],
    );
  }

  if (isLoading) {
    return (
      <Card>
        <ThemedView className="items-center justify-center py-8">
          <ThemedText
            className="text-base"
            lightColor={Colors.light.mutedText}
            darkColor={Colors.dark.mutedText}
          >
            Loading programs...
          </ThemedText>
        </ThemedView>
      </Card>
    );
  }

  return (
    <Card>
      <ThemedText type="subtitle" className="text-center my-4">
        Your Programs
      </ThemedText>
      <ThemedView>
        <ScrollView
          className="max-h-[48rem]"
          keyboardShouldPersistTaps="handled"
        >
          <View>
            {programs && programs.length > 0 ? (
              <ThemedView className="gap-3 mb-3">
                {programs.map((program) => (
                  <ProgramCard
                    key={program.id}
                    program={program}
                    onDelete={handleDeleteProgram}
                  />
                ))}
              </ThemedView>
            ) : (
              <ThemedView className="items-center py-8">
                <Feather
                  name="calendar"
                  size={32}
                  color={Colors[theme].mutedText}
                />
                <ThemedText
                  className="text-center text-base font-semibold mt-4"
                  lightColor={Colors.light.mutedText}
                  darkColor={Colors.dark.mutedText}
                >
                  No programs yet
                </ThemedText>
                <ThemedText
                  className="text-center text-sm mt-1"
                  lightColor={Colors.light.mutedText}
                  darkColor={Colors.dark.mutedText}
                >
                  Create a program to start planning your training week.
                </ThemedText>
              </ThemedView>
            )}
          </View>
        </ScrollView>

        <Button
          className="my-2"
          onPress={() => router.push("/(screens)/createProgram")}
        >
          Create Program
        </Button>
      </ThemedView>
    </Card>
  );
}
