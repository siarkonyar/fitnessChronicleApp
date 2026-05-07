import { queryKeys } from "@/constants/QueryKeys";
import { useServerErrorHandler } from "@/hooks/useServerErrorHandler";
import { formatDateAsString, getTodayString } from "@/lib/dateUtils";
import { getUserSettings } from "@/lib/firebase/user";
import { deleteWeightLogById } from "@/lib/firebase/weight";
import { WeightWithIdSchema } from "@/types/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useEffect } from "react";
import { Alert, Platform, ScrollView } from "react-native";
import { z } from "zod";
import { Button } from "../Button";
import Card from "../Card";
import MutedCard from "../cards/MuteCard";
import { RoundedButton } from "../RoundButton";
import { ThemedText } from "../ThemedText";
import { ThemedView } from "../ThemedView";

type WeightLog = z.infer<typeof WeightWithIdSchema>;

export default function WeightListModal({
  weightLogs,
  onCancel,
}: {
  weightLogs: WeightLog[];
  onCancel?: () => void;
}) {
  const { handleMutationError, handleQueryError } = useServerErrorHandler();
  const queryClient = useQueryClient();
  const sortedLogs = [...weightLogs].sort((a, b) =>
    b.date.localeCompare(a.date),
  );

  const { data: userSettings, error: userSettingsError } = useQuery({
    queryKey: queryKeys.userSettings.all,
    queryFn: getUserSettings,
  });

  useEffect(() => {
    if (userSettingsError) {
      handleQueryError(userSettingsError);
    }
  }, [userSettingsError, handleQueryError]);

  const weightMeasure = userSettings?.measure ?? "kg";

  const deleteWeightLogMutation = useMutation({
    mutationFn: deleteWeightLogById,
    onError: (error) => {
      handleMutationError(error);
    },
    onSuccess: (data, variables) => {
      // Invalidate queries to refetch data
      queryClient.invalidateQueries({
        queryKey: queryKeys.weightLogs.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.weightLogs.todayStatus(getTodayString()),
      });
    },
  });

  const handleDeleteWeight = async (id: string) => {
    if (!id) return;
    Alert.alert(
      "Delete Label",
      "Are you sure you want to delete this weight log?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteWeightLogMutation.mutateAsync(id);
            } catch (error) {
              console.log(error);
            }
          },
        },
      ],
    );
  };

  return (
    <>
      <Card>
        {weightLogs.length === 0 ? (
          <ThemedText className="opacity-60">No weight logs</ThemedText>
        ) : (
          <ScrollView
            className="max-h-96"
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
          >
            {sortedLogs.map((log) => (
              <ThemedView key={log.id}>
                <MutedCard
                  key={log.id}
                  className={`items-center justify-between mb-2`}
                >
                  <ThemedText>{formatDateAsString(log.date)}</ThemedText>
                  <ThemedText>
                    {log.weight} {weightMeasure}
                  </ThemedText>
                  <RoundedButton
                    type="danger"
                    icon="delete"
                    onPress={() => handleDeleteWeight(log.id)}
                  />
                </MutedCard>
              </ThemedView>
            ))}
          </ScrollView>
        )}
      </Card>
      <Button type="danger" onPress={onCancel}>
        Cancel
      </Button>
    </>
  );
}
