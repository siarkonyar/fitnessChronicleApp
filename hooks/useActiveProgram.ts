import { queryKeys } from "@/constants/QueryKeys";
import { daysBetween, getTodayString } from "@/lib/dateUtils";
import { getPrograms } from "@/lib/firebase/program";
import { getUserSettings, updateUserSettings } from "@/lib/firebase/user";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useServerErrorHandler } from "./useServerErrorHandler";

export function useActiveProgram() {
  const queryClient = useQueryClient();
  const { handleQueryError, handleMutationError } = useServerErrorHandler();

  const {
    data: settings,
    isLoading: isLoadingSettings,
    error: settingsError,
  } = useQuery({
    queryKey: queryKeys.userSettings.all,
    queryFn: getUserSettings,
  });

  const {
    data: programs,
    isLoading: isLoadingPrograms,
    error: programsError,
  } = useQuery({
    queryKey: queryKeys.programs.all,
    queryFn: getPrograms,
  });

  useEffect(() => {
    if (settingsError) handleQueryError(settingsError);
  }, [settingsError, handleQueryError]);

  useEffect(() => {
    if (programsError) handleQueryError(programsError);
  }, [programsError, handleQueryError]);

  const activeProgram = programs?.find(
    (program) => program.id === settings?.activeProgramId,
  );

  const advanceDayMutation = useMutation({
    mutationFn: updateUserSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.userSettings.all });
    },
  });

  useEffect(() => {
    if (!settings || !activeProgram) return;
    if (activeProgram.days.length === 0) return;
    if (settings.activeProgramDayDate === undefined) return;
    if (settings.activeProgramDay === undefined) return;
    if (advanceDayMutation.isPending) return;

    const today = getTodayString();
    const elapsed = daysBetween(settings.activeProgramDayDate, today);
    if (elapsed <= 0) return;

    const nextDay =
      (settings.activeProgramDay + elapsed) % activeProgram.days.length;

    advanceDayMutation.mutate({
      activeProgramDay: nextDay,
      activeProgramDayDate: today,
    });
  }, [settings, activeProgram, advanceDayMutation]);

  const selectProgramMutation = useMutation({
    mutationFn: (programId: string) =>
      updateUserSettings({
        activeProgramId: programId,
        activeProgramDay: 0,
        activeProgramDayDate: getTodayString(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.userSettings.all });
    },
    onError: (error) => {
      handleMutationError(error);
    },
  });

  return {
    activeProgram,
    programDay: settings?.activeProgramDay,
    selectProgram: selectProgramMutation.mutate,
    isSelecting: selectProgramMutation.isPending,
    isLoading: isLoadingSettings || isLoadingPrograms,
  };
}
