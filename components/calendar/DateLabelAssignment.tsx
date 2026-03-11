import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import { queryKeys } from "@/constants/QueryKeys";
import { useServerErrorHandler } from "@/hooks/useServerErrorHandler";
import {
  addLabel,
  asignLabelToDay,
  deleteAssignment,
  getAllLabels,
  getLabelAsignmentByDate,
} from "@/lib/firebase/label";
import { LabelSchema, LabelWithIdSchema } from "@/types/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { z } from "zod";
import { Button } from "../Button";
import Card from "../Card";
import AddLabelCard from "../cards/AddLabelCard";
import LabelCard from "../cards/LabelCard";
import { RoundedButton } from "../RoundButton";
import { ThemedView } from "../ThemedView";

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

  const [isLabelSelectionOpen, setIsLabelSelectionOpen] = React.useState(false);
  const [isAssigningLabel, setIsAssigningLabel] = React.useState(false);
  const [isAddingLabel, setIsAddingLabel] = useState(false);
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [isLabelEmpty, setIsLabelEmpty] = useState(false);

  type LabelWithID = z.infer<typeof LabelWithIdSchema>;
  const addLabelMutation = useMutation({
    mutationFn: addLabel,
    onError: (error) => {
      handleMutationError(error);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.labels.all,
      });
    },
  });

  const canSubmit =
    label.trim().length > 0 && description.trim().length > 0 && !isAdding;

  async function handleAddLabel() {
    if (label === "" || description === "") {
      setIsLabelEmpty(true);
      return;
    }
    if (!canSubmit) return;
    try {
      setIsAdding(true);
      await addLabelMutation.mutateAsync({
        label: label.trim(),
        description: description.trim(),
        dates: [] as string[],
      });
    } catch (error) {
      console.log(error);
    } finally {
      setIsAdding(false);
      setIsAddingLabel(false);
      setLabel("");
      setDescription("");
    }
  }

  async function handleAddLabelPress() {
    if (isAddingLabel) return;
    setIsAddingLabel(true);
    setLabel("");
    setDescription("");
  }

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
  const { data: labelsRaw, error: labelsRawError } = useQuery({
    queryKey: queryKeys.labels.all,
    queryFn: () => getAllLabels(),
  });

  useEffect(() => {
    if (error) {
      handleQueryError(error);
    } else if (labelsRawError) {
      handleQueryError(labelsRawError);
    }
  }, [error, labelsRawError, handleQueryError]);

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

  const labels: LabelWithID[] = labelsRaw as LabelWithID[];

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
    setIsAddingLabel(false);
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
                <Card>
                  <ThemedView>
                    <ScrollView className="max-h-96">
                      <View className="p-6">
                        {labels.length > 0 ? (
                          <View className="flex-col gap-3 mb-6">
                            {labels.map((item, index) => (
                              <LabelCard
                                label={item}
                                index={index}
                                key={item.id}
                                editable
                                onPress={handleAsignLabelToDay}
                              />
                            ))}
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
                          </View>
                        )}

                        {isAddingLabel ? (
                          <>
                            <ThemedView className="flex-row gap-2 items-center mb-8">
                              <ThemedView className="flex-1">
                                <AddLabelCard
                                  label={label}
                                  description={description}
                                  setLabel={setLabel}
                                  setDescription={setDescription}
                                />
                              </ThemedView>

                              <RoundedButton
                                icon="plus"
                                type="success"
                                onPress={handleAddLabel}
                                disabled={isAdding}
                              />
                            </ThemedView>
                          </>
                        ) : null}
                        {isLabelEmpty ? (
                          <Text
                            className="text-xs"
                            style={{
                              color: Colors[theme].danger,
                            }}
                          >
                            Label or the description is empty!
                          </Text>
                        ) : null}

                        <Button
                          className="mb-2"
                          disabled={isAddingLabel}
                          onPress={handleAddLabelPress}
                        >
                          Add Labels
                        </Button>
                      </View>
                    </ScrollView>
                  </ThemedView>
                </Card>
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
