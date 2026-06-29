import ProgramForm from "@/components/ProgramForm";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Colors } from "@/constants/Colors";
import { queryKeys } from "@/constants/QueryKeys";
import { useServerErrorHandler } from "@/hooks/useServerErrorHandler";
import { updateProgram } from "@/lib/firebase/program";
import { ProgramDaySchema, ProgramWithIdSchema } from "@/types/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { z } from "zod";

type ProgramDay = z.infer<typeof ProgramDaySchema>;
type ProgramWithId = z.infer<typeof ProgramWithIdSchema>;

export default function EditProgramScreen() {
  const { program: programParam } = useLocalSearchParams<{ program: string }>();
  const queryClient = useQueryClient();
  const { handleMutationError } = useServerErrorHandler();

  const program = useMemo<ProgramWithId | null>(() => {
    if (!programParam) return null;
    try {
      return JSON.parse(programParam) as ProgramWithId;
    } catch {
      return null;
    }
  }, [programParam]);

  const updateProgramMutation = useMutation({
    mutationFn: ({ name, days }: { name: string; days: ProgramDay[] }) => {
      if (!program) throw new Error("Program not found.");
      return updateProgram(program.id, { name, days });
    },
    onError: (mutationError) => {
      handleMutationError(mutationError);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.programs.all });
      if (program) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.programs.byId(program.id),
        });
      }
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

  if (!program) {
    return (
      <ThemedView className="flex-1 items-center justify-center px-8">
        <ThemedText
          className="text-center text-base font-semibold"
          lightColor={Colors.light.mutedText}
          darkColor={Colors.dark.mutedText}
        >
          Program not found
        </ThemedText>
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
