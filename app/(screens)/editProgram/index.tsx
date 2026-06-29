import ProgramForm from "@/components/ProgramForm";
import { ThemedView } from "@/components/ThemedView";
import { Colors } from "@/constants/Colors";
import { queryKeys } from "@/constants/QueryKeys";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useServerErrorHandler } from "@/hooks/useServerErrorHandler";
import { getProgram, updateProgram } from "@/lib/firebase/program";
import { ProgramDaySchema } from "@/types/types";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator } from "react-native";
import { z } from "zod";

type ProgramDay = z.infer<typeof ProgramDaySchema>;

export default function EditProgramScreen() {
  const { programId } = useLocalSearchParams<{ programId: string }>();
  const theme = useColorScheme() ?? "light";
  const queryClient = useQueryClient();
  const { handleQueryError, handleMutationError } = useServerErrorHandler();

  const {
    data: program,
    isLoading,
    error,
  } = useQuery({
    queryFn: () => getProgram(programId),
    queryKey: queryKeys.programs.byId(programId),
  });

  useEffect(() => {
    if (error) {
      handleQueryError(error);
    }
  }, [error, handleQueryError]);

  const updateProgramMutation = useMutation({
    mutationFn: ({ name, days }: { name: string; days: ProgramDay[] }) =>
      updateProgram(programId, { name, days }),
    onError: (mutationError) => {
      handleMutationError(mutationError);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.programs.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.programs.byId(programId),
      });
    },
  });

  const handleSubmit = async (name: string, days: ProgramDay[]) => {
    try {
      await updateProgramMutation.mutateAsync({ name, days });
      router.back();
    } catch (submitError) {
      console.error("Failed to update program:", submitError);
    }
  };

  if (isLoading || !program) {
    return (
      <ThemedView className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={Colors[theme].highlight} />
      </ThemedView>
    );
  }

  return (
    <ProgramForm
      initialName={program.name}
      initialDays={program.days}
      submitLabel="Save Changes"
      pendingLabel="Saving Changes..."
      isSubmitting={updateProgramMutation.isPending}
      onSubmit={handleSubmit}
    />
  );
}
