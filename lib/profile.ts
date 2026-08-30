import { z } from "zod";
import { GenderSchema, UserProfileSchema } from "../types/types";

export type GenderValue = z.infer<typeof GenderSchema>;
type UserProfile = z.infer<typeof UserProfileSchema>;

/**
 * Whether the user has answered the questions onboarding exists to ask.
 *
 * Birthday is deliberately not part of this: it is optional, so requiring it
 * would trap anyone who chose to leave it blank on the onboarding screen
 * forever. Name and gender are the two the screen refuses to submit without.
 */
export function isProfileComplete(profile: UserProfile): boolean {
  return Boolean(profile.name?.trim() && profile.gender);
}

const EARLIEST_BIRTH_YEAR = 1900;
const MIN_MONTH = 1;
const MAX_MONTH = 12;
const MIN_DAY = 1;
const MAX_DAY = 31;

export const GENDER_OPTIONS: readonly {
  value: GenderValue;
  label: string;
}[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "non_binary", label: "Non-binary" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

export function genderLabel(value: string): string {
  return GENDER_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

/**
 * Validates a birthday typed as three separate fields.
 *
 * Returns null when the date is usable, or a message ready to show the user.
 * The final Date round-trip is what catches days that pass the 1-31 range
 * check but do not exist in that particular month, e.g. 29 February 2023.
 */
export function validateBirthday(
  day: string,
  month: string,
  year: string,
): string | null {
  if (!day || !month || !year) return "Please fill in all fields.";

  const currentYear = new Date().getFullYear();
  const d = parseInt(day, 10);
  const m = parseInt(month, 10);
  const y = parseInt(year, 10);

  if (isNaN(d) || d < MIN_DAY || d > MAX_DAY)
    return "Day must be between 01 and 31.";
  if (isNaN(m) || m < MIN_MONTH || m > MAX_MONTH)
    return "Month must be between 01 and 12.";
  if (isNaN(y) || y < EARLIEST_BIRTH_YEAR || y > currentYear)
    return `Year must be between ${EARLIEST_BIRTH_YEAR} and ${currentYear}.`;

  const date = new Date(y, m - 1, d);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  )
    return "Invalid date.";

  return null;
}

/**
 * Builds the YYYY-MM-DD string that UserProfileSchema.birthday expects.
 * Call only after validateBirthday has returned null.
 */
export function toIsoBirthday(
  day: string,
  month: string,
  year: string,
): string {
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function formatDisplayBirthday(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day} / ${month} / ${year}`;
}
