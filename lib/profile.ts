import { z } from "zod";
import { GenderSchema, UserProfileSchema } from "../types/types";

export type GenderValue = z.infer<typeof GenderSchema>;
type UserProfile = z.infer<typeof UserProfileSchema>;

/**
 * Whether the user has answered the questions onboarding exists to ask.
 *
 * Birthday is deliberately not part of this, even though onboarding now
 * requires it. Accounts created before that change have no birthday stored, and
 * adding it here would throw every one of those users back into onboarding —
 * an age gate applied to people who are already through the door. The gate
 * belongs on the way in, which is where the onboarding screen enforces it.
 */
export function isProfileComplete(profile: UserProfile): boolean {
  return Boolean(profile.name?.trim() && profile.gender);
}

/**
 * The youngest age that may open an account.
 *
 * 13 is the floor two separate regimes converge on: COPPA treats anyone under
 * 13 as requiring verifiable parental consent, and UK GDPR Article 8 sets 13 as
 * the age a child can consent to an information society service on their own.
 * The AI coach and analytics both run on consent (see the Privacy Policy,
 * section 4), and consent given by someone below this age is not valid consent.
 *
 * Some EEA states set their Article 8 age as high as 16. This check does not
 * try to vary by country: it enforces the floor, not the ceiling.
 */
export const MINIMUM_AGE_YEARS = 13;

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

/**
 * Whole years between a birthday and today.
 *
 * Counts completed years, not year subtraction: someone born on 31 December
 * 2012 is 12 for all but the last day of 2025, and a plain
 * currentYear - birthYear would have called them 13 from January. That
 * difference is the entire point of the check this feeds.
 *
 * Call only after validateBirthday has returned null.
 */
export function calculateAge(day: string, month: string, year: string): number {
  const today = new Date();
  const birthYear = parseInt(year, 10);
  const birthMonth = parseInt(month, 10) - 1;
  const birthDay = parseInt(day, 10);

  const hasHadBirthdayThisYear =
    today.getMonth() > birthMonth ||
    (today.getMonth() === birthMonth && today.getDate() >= birthDay);

  return today.getFullYear() - birthYear - (hasHadBirthdayThisYear ? 0 : 1);
}

/** Whether this birthday belongs to someone too young to hold an account. */
export function isUnderMinimumAge(
  day: string,
  month: string,
  year: string,
): boolean {
  return calculateAge(day, month, year) < MINIMUM_AGE_YEARS;
}

export function formatDisplayBirthday(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day} / ${month} / ${year}`;
}
