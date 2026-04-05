import { queryKeys } from "@/constants/QueryKeys";
import { useServerErrorHandler } from "@/hooks/useServerErrorHandler";
import { getTodayString } from "@/lib/dateUtils";
import { addWeightLog } from "@/lib/firebase/weight";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { Keyboard } from "react-native";
import { Button } from "../Button";
import Card from "../Card";
import { ThemedTextInput } from "../ThemedTextInput";

type WeightEntryModalProps = {
  onLogged?: () => void;
  onCancel?: () => void;
};

export default function WeightEntryModal({
  onLogged,
  onCancel,
}: WeightEntryModalProps) {
  const [weight, setWeight] = useState("");
  const { handleMutationError } = useServerErrorHandler();
  const queryClient = useQueryClient();

  const normalizeWeightInput = (value: string) => value.replace(/,/g, ".");

  const addWeightLogMutation = useMutation({
    mutationFn: addWeightLog,
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
      setWeight("");
      onLogged?.();
    },
  });

  const handleLogWeight = async () => {
    const parsedWeight = Number(normalizeWeightInput(weight.trim()));
    if (!Number.isFinite(parsedWeight)) return;
    await addWeightLogMutation.mutateAsync(parsedWeight);
  };
  return (
    <Card>
      <ThemedTextInput
        value={weight}
        onChangeText={(value) => setWeight(normalizeWeightInput(value))}
        keyboardType="decimal-pad"
        returnKeyType="done"
        onSubmitEditing={() => Keyboard.dismiss()}
        maxLength={6}
        className="bg-gray-200 dark:bg-gray-900 rounded-lg p-3 text-2xl leading-[24px] w-full text-center"
      />

      <Button onPress={handleLogWeight}>Log Weight</Button>
      <Button type="danger" onPress={onCancel}>
        Cancel
      </Button>
    </Card>
  );
}
