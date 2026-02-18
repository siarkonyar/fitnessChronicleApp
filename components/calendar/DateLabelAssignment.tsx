import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import { queryKeys } from "@/constants/QueryKeys";
import { useServerErrorHandler } from "@/hooks/useServerErrorHandler";
import {
  asignLabelToDay,
  deleteAssignment,
  getAllLabels,
  getLabelAsignmentByDate,
  getLabelById,
} from "@/lib/firebase/label";
import { LabelSchema, LabelWithIdSchema } from "@/types/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
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
  const queryClient = useQueryClient();

  type LabelWithID = z.infer<typeof LabelWithIdSchema>;

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.labelAssignments.byDate(selectedDate),
    queryFn: () => getLabelAsignmentByDate(selectedDate),
  });
  const labelId = data?.labelId;
  const {
    data: label,
    isLoading: labelsLoading,
    error: labelError,
  } = useQuery({
    queryKey: queryKeys.labels.byId(labelId ? labelId : "undefined"),
    queryFn: () => getLabelById(labelId ? labelId : "undefined"),
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
  const { data: labelsRaw, error: labelsRawError } = useQuery({
    queryKey: queryKeys.labels.all,
    queryFn: () => getAllLabels(),
  });
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
      <ThemedView className="w-full flex-row px-4 justify-center items-center">
        {data && label ? (
          <>
            <LabelCard
              label={label}
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
                    <ThemedText className="text-sm text-center opacity-50 mb-2">
                      Please add some labels first
                    </ThemedText>
                    <Button
                      className="mt-1"
                      onPress={() => {
                        setIsLabelSelectionOpen(false);
                        router.push("/settings");
                      }}
                    >
                      Add Labels
                    </Button>
                  </View>
                )}

                <Button
                  type="danger"
                  onPress={() => setIsLabelSelectionOpen(false)}
                >
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
