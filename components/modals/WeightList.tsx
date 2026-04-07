import { queryKeys } from "@/constants/QueryKeys";
import { useServerErrorHandler } from "@/hooks/useServerErrorHandler";
import { getTodayString } from "@/lib/dateUtils";
import { deleteWeightLogById } from "@/lib/firebase/weight";
import { WeightWithIdSchema } from "@/types/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import React from "react";
import { z } from "zod";
import { Button } from "../Button";
import Card from "../Card";
import { ThemedText } from "../ThemedText";
import { ThemedView } from "../ThemedView";

type WeightLog = z.infer<typeof WeightWithIdSchema>;

export default function WeightList({
  weightLogs,
  onCancel,
}: {
  weightLogs: WeightLog[];
  onCancel?: () => void;
}) {
  const { handleMutationError, handleQueryError } = useServerErrorHandler();
  const queryClient = useQueryClient();

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
    await deleteWeightLogMutation.mutateAsync(id);
  };

  return (
    <>
      <Card>
        {weightLogs.length === 0 ? (
          <ThemedText className="opacity-60">No weight logs</ThemedText>
        ) : (
          weightLogs.map((log) => (
            <ThemedView
              key={log.id}
              className="flex-row items-center justify-between py-2 border-b"
            >
              <ThemedText>{log.date}</ThemedText>
              <ThemedText>{log.weight} kg</ThemedText>
              <Button
                type="danger"
                onPress={() => handleDeleteWeight(log.id)}
                disabled={deleteWeightLogMutation.isPending}
              >
                Delete
              </Button>
            </ThemedView>
          ))
        )}
      </Card>
      <Button type="danger" onPress={onCancel}>
        Cancel
      </Button>
    </>
  );
}
