// Entry point for the Hercule Cloud Functions codebase.
// Every deployed function must be re-exported from this file.

import { onCall, HttpsError, CallableRequest } from "firebase-functions/https";
import { defineSecret } from "firebase-functions/params";
import { coachFlow } from "./ai/flows/coach.js";
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
  }
);

interface CoachResponse {
  reply: string;
}

/**
 * One turn of the AI coach.
 *
 * The order below is deliberate and will matter more at step 6: authenticate,
 * validate, THEN spend money. The quota gate slots in between validation and
 * the flow call, so a blocked user never reaches Gemini — a gate that runs
 * afterwards costs us on every rejection.
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

    // Step 6 inserts the quota check here, before the flow runs.

    const result = await coachFlow(parsed.data);

    // Step 6 records result.totalTokens here and returns percentUsed.

    // Only the reply crosses the wire. Never token counts, never cost.
    return { reply: result.reply };
  }
);
