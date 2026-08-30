// Entry point for the Hercule Cloud Functions codebase.
// Every deployed function must be re-exported from this file.

import { CallableRequest, HttpsError, onCall } from "firebase-functions/https";
import { defineSecret } from "firebase-functions/params";
import { coachFlow } from "./ai/flows/coach.js";
import { onConsentChanged } from "./consent/recordConsentChange.js";
import { checkQuota, toPercentUsed } from "./quota/check.js";
import { recordUsage } from "./quota/record.js";
import { CoachRequestSchema, isPlausibleToday } from "./types.js";

/**
 * The Gemini API key, held in Secret Manager.
 *
 * Declaring it here is what makes Firebase mount it as the GEMINI_API_KEY
 * environment variable at runtime, which is where the Google AI plugin in
 * src/ai/genkit.ts picks it up. The value is never in source.
 */
const geminiApiKey = defineSecret("GEMINI_API_KEY");

/**
 * Region for every function in this codebase.
 *
 * Must match the Firestore location in firebase.json ("europe-west2"), so
 * reads stay inside one region instead of crossing the Atlantic per query.
 */
export const REGION = "europe-west2";

/**
 * Re-exported so it deploys. Defined in ./consent/recordConsentChange.ts —
 * it is a Firestore trigger, not a callable, so nothing in the app calls it
 * directly and it would silently never run if this line were missing.
 */
export { onConsentChanged };

interface PingResponse {
  uid: string;
  echo: unknown;
  receivedAt: string;
}

/**
 * A deliberately trivial callable, used to prove the plumbing works before
 * any AI code exists: request in, auth resolved, response out.
 *
 * It is not part of the coach. Keep it as a health check.
 */
export const ping = onCall(
  { region: REGION, maxInstances: 2 },
  (request: CallableRequest): PingResponse => {
    // request.auth is set by the SDK only after it has verified the caller's
    // Firebase ID token. An unsigned or forged token leaves it undefined.
    //
    // Check uid explicitly, not just request.auth: the emulator does NOT
    // verify token signatures, so a malformed token there yields an auth
    // object with no uid. Production rejects such tokens, but a guard that
    // only ever holds in production is a guard you cannot test.
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "You must be signed in.");
    }

    return {
      // The one trustworthy uid. Never read a uid out of request.data.
      uid,
      // request.data is whatever the caller sent — untrusted, unvalidated.
      // Echoed back as `unknown` here precisely because nothing has checked it.
      echo: request.data,
      receivedAt: new Date().toISOString(),
    };
  },
);

interface CoachResponse {
  reply: string;
  program?: unknown;
  /** 0-100. The only usage figure the app is ever told — never tokens, never cost. */
  percentUsed: number;
}

/**
 * One turn of the AI coach.
 *
 * Order is deliberate: authenticate, validate, check quota, THEN spend money.
 * The quota gate runs before the flow call, so a blocked user never reaches
 * Gemini — a gate that ran afterwards would cost us on every rejection.
 */
export const chatWithCoach = onCall(
  { region: REGION, secrets: [geminiApiKey], maxInstances: 10 },
  async (request: CallableRequest): Promise<CoachResponse> => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "You must be signed in.");
    }

    // request.data is untrusted. Parse before anything reads a field off it.
    const parsed = CoachRequestSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError("invalid-argument", "Malformed coach request.");
    }

    // A device's date can legitimately differ from UTC by up to a day; further
    // than that is not a timezone, it is a bad value.
    if (!isPlausibleToday(parsed.data.today)) {
      throw new HttpsError("invalid-argument", "Bad date.");
    }

    // Checked before Gemini is ever called. remaining is compared against a
    // headroom buffer, not zero, because the cost of THIS turn is unknown
    // until it has already run.
    const quota = await checkQuota(uid);
    if (!quota.allowed) {
      // Firebase has no distinct too-many-requests code, so both refusals come
      // back as resource-exhausted and the app tells them apart by
      // details.reason. Without it a user who simply typed too fast would be
      // told they are out of allowance for the month.
      throw new HttpsError(
        "resource-exhausted",
        quota.reason === "rate_limit"
          ? "You're sending messages too quickly. Give it a moment."
          : "You've used up your AI coach allowance for this period.",
        { reason: quota.reason },
      );
    }

    // uid and prefs go in context, not in the flow input, so the model cannot
    // see or influence them. The Admin SDK ignores security rules, so a uid the
    // model chose would read a stranger's data.
    const result = await coachFlow(parsed.data, {
      context: {
        auth: { uid },
        prefs: parsed.data.prefs,
      },
    });

    // Recorded only after the flow succeeds — a failed turn must not be billed
    // against the user's allowance.
    await recordUsage(uid, result.totalTokens);

    // Only the reply, the proposed program, and a percentage cross the wire.
    // Never token counts, never cost.
    return {
      reply: result.reply,
      ...(result.program && { program: result.program }),
      percentUsed: toPercentUsed(
        quota.tokensUsed + result.totalTokens,
        quota.cap,
      ),
    };
  },
);

export const getUsagePercentage = onCall(
  { region: REGION, secrets: [geminiApiKey], maxInstances: 10 },
  async (request: CallableRequest): Promise<number> => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "You must be signed in.");
    }

    // spendRateToken: false — this is a read, not a turn. The app calls it
    // every time the chat box opens, so charging it against the rate-limit
    // bucket would let a user lock themselves out of the coach by opening and
    // closing the chat five times without ever sending a message.
    const quota = await checkQuota(uid, new Date(), { spendRateToken: false });

    return toPercentUsed(quota.tokensUsed, quota.cap);
  },
);
