import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import { useServerErrorHandler } from "@/hooks/useServerErrorHandler";
import { trpc } from "@/lib/trpc";
import { LabelSchema, LabelWithIdSchema } from "@/types/types";
import React, { useEffect } from "react";
import {
  ActivityIndicator,
  Modal,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { z } from "zod";
import { Button } from "../Button";
import Card from "../Card";
import { ThemedView } from "../ThemedView";
import LabelCard from "../cards/LabelCard";
import MutedCard from "../cards/MuteCard";

// Represents an label assignment joined with its label data
export type DateLabelAssignmentWithLabel = {
  id: string;
  date: string; // ISO string (e.g., 2025-08-12)
  labelId: string;
  label: typeof LabelSchema;
};

export default function DateLabelAssignment({
  selectedDate,
}: {
  selectedDate: string;
}) {
  const theme = useColorScheme() ?? "light";
  const { handleMutationError, handleQueryError } = useServerErrorHandler();

  type Label = z.infer<typeof LabelSchema>;
  type LabelWithID = z.infer<typeof LabelWithIdSchema>;

  const { data, isLoading, error } =
    trpc.label.getLabelAsignmentByDate.useQuery({
      date: selectedDate,
    }) as {
      data: DateLabelAssignmentWithLabel | undefined;
      isLoading: boolean;
      error: any;
    };
  const labelId = data?.labelId;
  const {
    data: label,
    isLoading: labelsLoading,
    error: labelError,
  } = trpc.label.getLabelById.useQuery(
    { id: labelId ?? "" },
    { enabled: !!labelId }
  ) as {
    data: Label | undefined;
    isLoading: boolean;
    error: any;
  };

  const asignLabelToDayMutation = trpc.label.asignLabelToDay.useMutation({
    onError: (error) => {
      handleMutationError(error);
    },
  });
  const deleteAssignedLabelMutation = trpc.label.deleteAssignment.useMutation({
    onError: (error) => {
      handleMutationError(error);
    },
  });
  const utils = trpc.useUtils();
  const { data: labelsRaw, error: labelsRawError } =
    trpc.label.getAllLabels.useQuery();
  const [isLabelSelectionOpen, setIsLabelSelectionOpen] = React.useState(false);
  const [isAssigningLabel, setIsAssigningLabel] = React.useState(false);

  useEffect(() => {
    if (error) {
      handleQueryError(error);
    } else if (labelError) {
      handleQueryError(labelError);
    } else if (labelsRawError) {
      handleQueryError(labelsRawError);
    }
  }, [error, labelError, labelsRawError, handleQueryError]);

  //TODO: after clicking on an label it shows the loading screen but right after that for a split second it shows the card again. it happens so fast but it is still annoying to see
  async function handleAsignLabelToDay(labelId: string) {
    try {
      setIsAssigningLabel(true);
      await asignLabelToDayMutation.mutateAsync({
        date: selectedDate,
        labelId: labelId,
      });
      // Invalidate relevant queries to refresh the data
      await utils.label.getLabelAsignmentByDate.invalidate({
        date: selectedDate,
      });
      // Also invalidate the calendar query to refresh label display
      await utils.label.getAllLabelsFromMonth.invalidate({
        date: selectedDate.slice(0, 7), // Get the month part (YYYY-MM)
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
      await deleteAssignedLabelMutation.mutateAsync({
        date: selectedDate,
      });
      // Invalidate relevant queries to refresh the data
      await utils.label.getLabelAsignmentByDate.invalidate({
        date: selectedDate,
      });
      // Also invalidate the calendar query to refresh label display
      await utils.label.getAllLabelsFromMonth.invalidate({
        date: selectedDate.slice(0, 7), // Get the month part (YYYY-MM)
      });

      setIsAssigningLabel(false);
      setIsLabelSelectionOpen(false);
    } catch (error) {
      console.error("Failed to delete label assignment:", error);
      setIsAssigningLabel(false);
    }
  }

  const labels: LabelWithID[] = Array.isArray(labelsRaw)
    ? (labelsRaw as LabelWithID[])
    : [];

  if (isLoading || labelsLoading) {
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
        {data && label ? (
          <MutedCard onPress={() => setIsLabelSelectionOpen(true)}>
            <View className="flex-col">
              <View className="flex-col items-center justify-center space-x-3">
                <Text className="text-4xl leading-11">{label.label}</Text>
                <ThemedText className="text-lg font-medium text-center text-gray-700 dark:text-gray-200">
                  {label.description}
                </ThemedText>
              </View>
              <ThemedText className="text-xs text-center mt-2 opacity-60">
                Tap to change
              </ThemedText>
            </View>
          </MutedCard>
        ) : (
          <Button onPress={() => setIsLabelSelectionOpen(true)}>
            Assign a Label to This Day
          </Button>
        )}
      </ThemedView>

      <Modal
        visible={isLabelSelectionOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsLabelSelectionOpen(false)}
      >
        <View className="flex-1 items-center justify-center px-4 bg-black/90 backdrop-blur-sm">
          {isAssigningLabel ? (
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

                {labels.length > 0 ? (
                  <View className="flex-col gap-3 mb-6">
                    {labels.map((item, index) => (
                      <LabelCard
                        label={item}
                        index={index}
                        key={index}
                        onPress={handleAsignLabelToDay}
                      />
                    ))}
                    {data && (
                      <Button
                        type="danger"
                        onPress={async () => {
                          handleDeleteAssignedLabel(selectedDate);
                        }}
                      >
                        Remove Label Assignment
                      </Button>
                    )}
                  </View>
                ) : (
                  <View className="items-center py-8">
                    <Text className="text-4xl mb-3">😔</Text>
                    <ThemedText className="text-center opacity-70 mb-2">
                      No labels available
                    </ThemedText>
                    <ThemedText className="text-sm text-center opacity-50">
                      Please add some labels first
                    </ThemedText>
                  </View>
                )}

                <Button onPress={() => setIsLabelSelectionOpen(false)}>
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
