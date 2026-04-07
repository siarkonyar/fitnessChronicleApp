import { Colors } from "@/constants/Colors";
import { queryKeys } from "@/constants/QueryKeys";
import { useServerErrorHandler } from "@/hooks/useServerErrorHandler";
import { getTodayString } from "@/lib/dateUtils";
import { addWeightLog } from "@/lib/firebase/weight";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { Keyboard, useColorScheme } from "react-native";
import { Button } from "../Button";
import Card from "../Card";
import { ThemedText } from "../ThemedText";
import { ThemedTextInput } from "../ThemedTextInput";
import { ThemedView } from "../ThemedView";

type WeightEntryModalProps = {
  onLogged?: () => void;
  onCancel?: () => void;
};

export default function WeightEntryModal({
  onLogged,
  onCancel,
}: WeightEntryModalProps) {
  const theme = useColorScheme() ?? "light";
  const palette = Colors[theme];
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

  const isValidWeight = Number.isFinite(
    Number(normalizeWeightInput(weight.trim())),
  );

  return (
    <Card className="gap-4">
      <ThemedView>
        <ThemedText type="subtitle" className="mt-1">
          Log Your Weight
        </ThemedText>
        <ThemedText
          className="mt-1"
          lightColor={palette.mutedText}
          darkColor={palette.mutedText}
        >
          Enter your current body weight
        </ThemedText>
      </ThemedView>

      <ThemedView
        className="flex-row items-center rounded-2xl border px-3 py-2"
        style={{
          backgroundColor: palette.cardBackground,
          borderColor: palette.cardBorderColor,
        }}
      >
        <ThemedTextInput
          value={weight}
          onChangeText={(value) => setWeight(normalizeWeightInput(value))}
          keyboardType="decimal-pad"
          returnKeyType="done"
          onSubmitEditing={() => Keyboard.dismiss()}
          maxLength={6}
          placeholder="e.g. 78.4"
          placeholderTextColor={palette.mutedText}
          className="flex-1 text-2xl"
        />
        <ThemedText
          type="defaultSemiBold"
          lightColor={palette.mutedText}
          darkColor={palette.mutedText}
        >
          kg
        </ThemedText>
      </ThemedView>

      <Button
        type="primary"
        onPress={handleLogWeight}
        disabled={!isValidWeight || addWeightLogMutation.isPending}
      >
        {addWeightLogMutation.isPending ? "Logging..." : "Log Weight"}
      </Button>
      <Button type="danger" onPress={onCancel}>
        Cancel
      </Button>
    </Card>
  );
}
