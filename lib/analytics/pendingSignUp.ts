import { logEvent } from "./client";

type SignUpMethod = "google" | "apple";

/**
 * A sign_up waiting for the user to answer the consent prompt.
 *
 * The event is created at credential time, when Firebase's isNewUser flag is
 * the only trustworthy signal that this account did not exist a moment ago —
 * and spent at the end of onboarding, once consent has been recorded. In
 * between it sits here.
 *
 * WHY IT HAS TO WAIT. Analytics collection is off until the onboarding prompt
 * is answered (lib/analytics/consent.ts). Sign-in happens before that prompt,
 * so a sign_up logged where the account is actually created is dropped by the
 * SDK for every user — including everyone who goes on to accept. The event
 * would be permanently absent and the acquisition report permanently empty.
 *
 * WHY MODULE STATE AND NOT AsyncStorage. Sign-up and onboarding are one
 * continuous session; there is nothing to survive. Persisting it would instead
 * create a flag that outlives the session that made it, so a user who abandoned
 * onboarding in March could fire a sign_up in June. Losing the event when
 * someone force-quits mid-onboarding is the smaller error, and it is the one
 * that fails in the direction of undercounting rather than inventing users.
 */
let pendingMethod: SignUpMethod | null = null;

/** Called on the credential that created the account. Records, never reports. */
export const rememberSignUp = (method: SignUpMethod): void => {
  pendingMethod = method;
};

/**
 * Reports the held sign_up, if there is one. Safe to call on every completed
 * onboarding — a returning user has nothing pending and this does nothing.
 *
 * Deliberately does NOT check whether consent was granted. The SDK's collection
 * switch is the single source of truth for that (see the header of client.ts):
 * with it off this call is a no-op, and a second consent check here would be a
 * copy of that state to keep in step forever.
 */
export const flushPendingSignUp = (): void => {
  if (!pendingMethod) return;

  const method = pendingMethod;
  // Cleared before reporting, so a failure inside logEvent cannot leave the
  // event armed to fire a second time on the next onboarding completion.
  pendingMethod = null;

  logEvent("sign_up", { method });
};
