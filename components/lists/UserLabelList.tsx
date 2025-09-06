import { useServerErrorHandler } from "@/hooks/useServerErrorHandler";
import { trpc } from "@/lib/trpc";
import { LabelWithIdSchema } from "@/types/types";
import { router } from "expo-router";
import React, { useEffect } from "react";
import { Text, View } from "react-native";
import { z } from "zod";
import { Button } from "../Button";
import Card from "../Card";
import { ThemedText } from "../ThemedText";
import LabelCard from "../cards/LabelCard";

export default function UserLabelList() {
  type labelScheme = z.infer<typeof LabelWithIdSchema>;
  const { handleQueryError } = useServerErrorHandler();
  const {
    data: labelsRaw,
    isLoading,
    error,
  } = trpc.label.getAllLabels.useQuery();
  const labels: labelScheme[] = Array.isArray(labelsRaw)
    ? (labelsRaw as labelScheme[])
    : [];

  useEffect(() => {
    if (error) {
      handleQueryError(error);
    }
  }, [error, handleQueryError]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center py-8">
        <ThemedText className="text-lg text-center opacity-70">
          Loading...
        </ThemedText>
      </View>
    );
  }

  return (
    <Card>
      <ThemedText className="text-xl font-bold mb-4 text-center">
        Your Label Collection
      </ThemedText>

      {labels.length > 0 ? (
        <View className="flex-col gap-3 mb-6">
          {labels.map((item, index) => (
            <LabelCard label={item} key={index} index={index} />
          ))}
        </View>
      ) : (
        <View className="items-center py-8 mb-6">
          <Text className="text-5xl mb-3">📝</Text>
          <ThemedText className="text-center opacity-70 mb-2 text-lg">
            No label yet
          </ThemedText>
          <ThemedText className="text-sm text-center opacity-50">
            Add your first label below to get started
          </ThemedText>
        </View>
      )}
      <Button onPress={() => router.push("/(screens)/addLabel")}>
        + Add Label
      </Button>
    </Card>
  );
}
