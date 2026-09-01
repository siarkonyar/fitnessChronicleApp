import { HttpsError } from "firebase-functions/https";
import { userDoc } from "../data/firestore.js";

/**
 * The server-side half of the AI coach consent gate.
 *
 * The client already hides the coach behind AiConsentGate until the user
 * grants users/{uid}.aiCoachConsent, but a client-only check has no force: a
 * modified app, a replayed request, or a client that has not yet synced the
 * write could still reach this callable. Consent that only the client
 * enforces is not really consent — it is a UI suggestion. This is what makes
 * it real: the callable that talks to Gemini refuses to run without it,
 * checked fresh from Firestore on every call, never taken from the request.
 *
 * Called before checkQuota deliberately — a request with no consent should
 * never spend a rate-limit token or come anywhere near billing a Gemini call.
 */
export const requireAiCoachConsent = async (uid: string): Promise<void> => {
  const doc = await userDoc(uid).get();
  const granted = doc.data()?.aiCoachConsent === true;

  if (!granted) {
    throw new HttpsError(
      "failed-precondition",
      "Turn on the AI Coach in Settings before sending a message.",
    );
  }
};
