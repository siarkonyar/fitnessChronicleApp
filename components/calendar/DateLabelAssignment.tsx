import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import { queryKeys } from "@/constants/QueryKeys";
import { useServerErrorHandler } from "@/hooks/useServerErrorHandler";
import {
  asignLabelToDay,
  deleteAssignment,
  getLabelAsignmentByDate,
} from "@/lib/firebase/label";
import { LabelSchema } from "@/types/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useEffect } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  useColorScheme,
  View,
} from "react-native";
import { Button } from "../Button";
import LabelCard from "../cards/LabelCard";
import UserLabelList from "../lists/UserLabelList";
import { ThemedView } from "../ThemedView";

// Represents an label assignment joined with its label data
export type DateLabelAssignmentWithLabel = {
  id: string;
  date: string; // ISO string (e.g., 2025-08-12)
  labelId: string;
  label: typeof LabelSchema;
};

export default function DateLabelAssignment({
  buttonText,
  selectedDate,
}: {
  buttonText: string;
  selectedDate: string;
}) {
  const theme = useColorScheme() ?? "light";
  const { handleMutationError, handleQueryError } = useServerErrorHandler();
  const queryClient = useQueryClient();

  const [isLabelSelectionOpen, setIsLabelSelectionOpen] = React.useState(false);
  const [isAssigningLabel, setIsAssigningLabel] = React.useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.labelAssignments.byDate(selectedDate),
    queryFn: () => getLabelAsignmentByDate(selectedDate),
  });

  const asignLabelToDayMutation = useMutation({
    mutationFn: asignLabelToDay,
    onError: (error) => {
      handleMutationError(error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.labelAssignments.byDate(selectedDate),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.labelAssignments.byMonth(selectedDate.slice(0, 7)),
      });
    },
  });
  const deleteAssignedLabelMutation = useMutation({
    mutationFn: deleteAssignment,
    onError: (error) => {
      handleMutationError(error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.labelAssignments.byDate(selectedDate),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.labelAssignments.byMonth(selectedDate.slice(0, 7)),
      });
    },
  });

  useEffect(() => {
    if (error) {
      handleQueryError(error);
    }
  }, [error, handleQueryError]);

  //TODO: after clicking on an label it shows the loading screen but right after that for a split second it shows the card again. it happens so fast but it is still annoying to see
  async function handleAsignLabelToDay(labelId: string) {
    try {
      setIsAssigningLabel(true);
      await asignLabelToDayMutation.mutateAsync({
        date: selectedDate,
        labelId: labelId,
      });

      setIsAssigningLabel(false);
      setIsLabelSelectionOpen(false);
    } catch (error) {
      console.error("Failed to assign label to day:", error);
      setIsAssigningLabel(false);
    }
  }
  async function handleDeleteAssignedLabel(date: string) {
    try {
      setIsAssigningLabel(true);
      await deleteAssignedLabelMutation.mutateAsync(selectedDate);

      setIsAssigningLabel(false);
      setIsLabelSelectionOpen(false);
    } catch (error) {
      console.error("Failed to delete label assignment:", error);
      setIsAssigningLabel(false);
    }
  }

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center py-8">
        <ThemedText className="text-lg text-center opacity-70">
          Loading...
        </ThemedText>
      </View>
    );
  }

  async function handleCloseModal() {
    setIsLabelSelectionOpen(false);
  }

  return (
    <>
      <ThemedView className="flex-row px-4 justify-center items-center w-9/12">
        {data ? (
          <>
            <LabelCard
              label={data}
              index={0}
              onPress={() => setIsLabelSelectionOpen(true)}
              className="self-start"
            />
          </>
        ) : (
          <Button
            onPress={() => setIsLabelSelectionOpen(true)}
            className="self-start"
          >
            {buttonText}
          </Button>
        )}
      </ThemedView>

      <Modal
        visible={isLabelSelectionOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsLabelSelectionOpen(false)}
      >
        <KeyboardAvoidingView
          keyboardVerticalOffset={-90}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          <View className="flex-1 items-center justify-center px-4 bg-black backdrop-blur-sm">
            {isAssigningLabel ? (
              <ActivityIndicator
                size="large"
                color={Colors[theme].highlight}
                className="mb-4"
              />
            ) : (
              <ThemedView className="w-11/12 max-w-md mx-4">
                <ThemedText className="text-2xl font-bold mb-2 text-center">
                  Choose What You Hit!
                </ThemedText>
                <ThemedText className="text-sm opacity-70 text-center mb-6">
                  {selectedDate}
                </ThemedText>
                <UserLabelList labelOnPress={handleAsignLabelToDay} />
                {data && (
                  <Button
                    type="danger"
                    onPress={async () => {
                      handleDeleteAssignedLabel(selectedDate);
                    }}
                    className="mb-4"
                  >
                    Remove Label Assignment
                  </Button>
                )}
                <Button type="danger" onPress={handleCloseModal}>
                  Cancel
                </Button>
              </ThemedView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
