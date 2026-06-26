import { daysBetween, getTodayString } from "@/lib/dateUtils";
import { ProgramWithIdSchema, UserSettingsSchema } from "@/types/types";
import { z } from "zod";

type UserSettings = z.infer<typeof UserSettingsSchema>;
type ProgramWithId = z.infer<typeof ProgramWithIdSchema>;

export function computeProgramDay(
  settings: UserSettings | undefined,
  activeProgram: ProgramWithId | undefined,
): number | undefined {
  if (
    !settings ||
    !activeProgram ||
    activeProgram.days.length === 0 ||
    settings.activeProgramDay === undefined ||
    settings.activeProgramDayDate === undefined
  ) {
    return settings?.activeProgramDay;
  }

  const elapsed = daysBetween(settings.activeProgramDayDate, getTodayString());
  if (elapsed <= 0) return settings.activeProgramDay;

  return (settings.activeProgramDay + elapsed) % activeProgram.days.length;
}
