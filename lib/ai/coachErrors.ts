/**
 * Reading the coach's refusals.
 *
 * Firebase has no distinct too-many-requests code, so the server sends both
 * refusals as resource-exhausted and separates them with details.reason.
 *
 * The code arrives spelled two ways. React Native Firebase reports callable
 * codes bare ("resource-exhausted") on device, while the Firebase JS SDK
 * prefixes them ("functions/resource-exhausted"). Matching only the prefixed
 * form made every quota and rate-limit refusal on a phone fall through to the
 * generic "Couldn't reach your coach" banner, so both are accepted here.
 */

export type CoachRejectionReason = "quota" | "rate_limit";

const RESOURCE_EXHAUSTED = "resource-exhausted";
const FUNCTIONS_CODE_PREFIX = "functions/";

const isResourceExhausted = (code: unknown): boolean =>
  code === RESOURCE_EXHAUSTED || code === `${FUNCTIONS_CODE_PREFIX}${RESOURCE_EXHAUSTED}`;

/**
 * Which refusal an error is, or null when it is not a refusal at all.
 *
 * A refusal with a missing or unknown reason reads as quota: that is the
 * terminal case, so the composer locks rather than inviting retries the
 * server will keep refusing.
 */
export const readRejectionReason = (error: unknown): CoachRejectionReason | null => {
  if (typeof error !== "object" || error === null) return null;

  const { code, details } = error as {
    code?: unknown;
    details?: { reason?: unknown } | null;
  };

  if (!isResourceExhausted(code)) return null;

  return details?.reason === "rate_limit" ? "rate_limit" : "quota";
};
