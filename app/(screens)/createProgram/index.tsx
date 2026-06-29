import ProgramForm from "@/components/ProgramForm";
import { queryKeys } from "@/constants/QueryKeys";
import { useServerErrorHandler } from "@/hooks/useServerErrorHandler";
import { addProgram } from "@/lib/firebase/program";
import { ProgramDaySchema } from "@/types/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { z } from "zod";

type ProgramDay = z.infer<typeof ProgramDaySchema>;

export default function CreateProgramScreen() {
  const queryClient = useQueryClient();
  const { handleMutationError } = useServerErrorHandler();

  const addProgramMutation = useMutation({
    mutationFn: ({ name, days }: { name: string; days: ProgramDay[] }) =>
      addProgram(name, days),
    onError: (error) => {
      handleMutationError(error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.programs.all });
    },
  });

  const handleSubmit = async (name: string, days: ProgramDay[]) => {
    try {
      await addProgramMutation.mutateAsync({ name, days });
      router.back();
    } catch (error) {
      console.error("Failed to create program:", error);
    }
  };

  return (
    <ProgramForm
      submitLabel="Create Program"
      pendingLabel="Creating Program..."
      isSubmitting={addProgramMutation.isPending}
      onSubmit={handleSubmit}
    />
  );
}
