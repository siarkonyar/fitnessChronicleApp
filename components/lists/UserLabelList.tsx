import { Colors } from "@/constants/Colors";
import { queryKeys } from "@/constants/QueryKeys";
import { useServerErrorHandler } from "@/hooks/useServerErrorHandler";
import { addLabel, getAllLabels } from "@/lib/firebase/label";
import { LabelWithIdSchema } from "@/types/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
import { Platform, ScrollView, Text, useColorScheme, View } from "react-native";
import { z } from "zod";
import { Button } from "../Button";
import Card from "../Card";
import AddLabelCard from "../cards/AddLabelCard";
import LabelCard from "../cards/LabelCard";
import { RoundedButton } from "../RoundButton";
import { ThemedText } from "../ThemedText";
import { ThemedView } from "../ThemedView";

export default function UserLabelList({
  labelOnPress,
}: {
  labelOnPress: (labelId: string) => void | Promise<void>;
}) {
  const theme = useColorScheme() ?? "light";

  const [isAddingLabel, setIsAddingLabel] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isLabelEmpty, setIsLabelEmpty] = useState(false);
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");

  const { handleMutationError, handleQueryError } = useServerErrorHandler();
  const queryClient = useQueryClient();

  const canSubmit =
    label.trim().length > 0 && description.trim().length > 0 && !isAdding;

  type labelScheme = z.infer<typeof LabelWithIdSchema>;
  const {
    data: labelsRaw,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.labels.all,
    queryFn: () => getAllLabels(),
  });

  const labels: labelScheme[] = Array.isArray(labelsRaw)
    ? (labelsRaw as labelScheme[])
    : [];

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

  useEffect(() => {
    console.log("Labels fetched:", labelsRaw);
    console.log("error:", error);
    console.log("isLoading:", isLoading);
    if (error) {
      handleQueryError(error);
    }
  }, [isLoading, labelsRaw, error, handleQueryError]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center py-8">
        <ThemedText className="text-center opacity-70">Loading...</ThemedText>
      </View>
    );
  }

  return (
    <Card>
      <ThemedView className="mb-2">
        <ThemedText type="label">LABELS</ThemedText>
        <ThemedText type="subtitle">Your Label Collection</ThemedText>
      </ThemedView>
      <ThemedView>
        <ScrollView
          className="max-h-96"
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        >
          <View className="p-3">
            {labels.length > 0 ? (
              <View className="flex-col gap-3 mb-6">
                {labels.map((item, index) => (
                  <LabelCard
                    label={item}
                    index={index}
                    key={item.id}
                    editable
                    onPress={labelOnPress}
                  />
                ))}
              </View>
            ) : (
              <View className="items-center py-8">
                <Text className="text-4xl mb-3">😔</Text>
                <ThemedText className="text-center opacity-70 mb-2">
                  No labels available
                </ThemedText>
                <ThemedText className="text-center opacity-50 mb-2">
                  Please add some labels first
                </ThemedText>
              </View>
            )}

            {isAddingLabel ? (
              <>
                <ThemedView className="flex-row gap-2 items-center mb-2">
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

                  <RoundedButton
                    icon="x-octagon"
                    type="danger"
                    onPress={() => setIsAddingLabel(false)}
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
          </View>
        </ScrollView>
        <Button
          className="mt-6"
          disabled={isAddingLabel}
          onPress={handleAddLabelPress}
        >
          Add Label
        </Button>
      </ThemedView>
    </Card>
  );
}
