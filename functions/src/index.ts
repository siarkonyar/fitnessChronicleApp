// Entry point for the Hercule Cloud Functions codebase.
// Every deployed function must be re-exported from this file.

import { CallableRequest, HttpsError, onCall } from "firebase-functions/https";
import { defineSecret } from "firebase-functions/params";
import { coachFlow } from "./ai/flows/coach.js";
import { COACH_MODEL, COACH_THINKING_LEVEL } from "./ai/genkit.js";
import { onUserCreated } from "./account/createAiUsage.js";
import { onUserDeleted } from "./account/deleteAiUsage.js";
import { onConsentChanged } from "./consent/recordConsentChange.js";
import { onRevenueCatCustomerWritten } from "./revenuecat/syncCustomer.js";
import { recordTurn } from "./telemetry/aiTurn.js";
import { checkQuota, toPercentUsed } from "./quota/check.js";
import type { Tier } from "./quota/caps.js";
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
 * Everything the app is allowed to know about its own allowance.
 *
 * Deliberately shared by both callables below so the two can never disagree
 * about the shape — the chat reply carries a fresh copy of exactly what
 * getUsagePercentage would return, which is what lets the app keep one cached
 * answer instead of reconciling two.
 *
 * `tier` is always "free" today: syncCustomer can write a paid tier, but only
 * from documents the RevenueCat extension writes, and the extension is not
 * installed yet. It is sent anyway, and that is the entire
 * point: a callable's response shape is a contract with every already-
 * installed app, so adding a field later would break every build in the wild.
 * Sending it now, while the only possible value is the one the app already
 * assumes, costs nothing and makes the RevenueCat change additive.
 *
 * Never token counts, never cost, never the cap — a percentage tells the user
 * what they need without publishing what a turn costs us.
 */
export interface AiUsageResponse {
  /** 0-100, rounded. */
  percentUsed: number;
  /** ISO 8601, or null when no period has been set. */
  resetsAt: string | null;
  tier: Tier;
}

/** Dates do not survive a callable's JSON boundary as Dates. */
const toIso = (date: Date | null): string | null =>
  date === null ? null : date.toISOString();

/**
 * Re-exported so it deploys. Defined in ./consent/recordConsentChange.ts —
 * it is a Firestore trigger, not a callable, so nothing in the app calls it
 * directly and it would silently never run if this line were missing.
 */
export { onConsentChanged };

/**
 * Re-exported so it deploys. Defined in ./account/createAiUsage.ts — an auth
 * trigger, so nothing calls it directly and it would silently never run if
 * this line were missing.
 */
export { onUserCreated };

/**
 * Re-exported so it deploys. Defined in ./account/deleteAiUsage.ts — an auth
 * onDelete trigger, fired by the deleteUser call at the end of the app's
 * deleteAccount flow. Nothing calls it directly, so a missing line here would
 * leave every deleted account's usage counter behind with no error anywhere.
 */
export { onUserDeleted };

/**
 * Re-exported so it deploys. Defined in ./revenuecat/syncCustomer.ts — a
 * Firestore trigger on the documents the RevenueCat extension writes. Nothing
 * calls it directly, so a missing line here would take people's money and
 * never give them the plan they paid for, with no error anywhere.
 */
export { onRevenueCatCustomerWritten };

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

/**
 * Extends the usage shape rather than restating it, so a field added to one
 * endpoint can never be forgotten on the other.
 */
interface CoachResponse extends AiUsageResponse {
  reply: string;
  program?: unknown;
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

    // Shared by every recordTurn call below. Message CHARS, never the message.
    const turnContext = {
      uid,
      tier: quota.tier,
      messageChars: parsed.data.message.length,
      historyLength: parsed.data.history.length,
    };

    if (!quota.allowed) {
      // Safe on this path only because recordTurn writes to logs and not to
      // Firestore — this is the branch a flood hits over and over.
      recordTurn({
        ...turnContext,
        outcome: quota.reason === "rate_limit" ? "rate_limit" : "quota",
      });

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
    let result;
    try {
      result = await coachFlow(parsed.data, {
        context: {
          auth: { uid },
          prefs: parsed.data.prefs,
        },
      });
    } catch (error) {
      // A failed turn still cost time and may have cost tokens we cannot see,
      // and it is invisible in the usage counter because recordUsage never
      // runs. Logging it here is the only way a rising failure rate shows up
      // anywhere at all.
      recordTurn({ ...turnContext, outcome: "error" });
      throw error;
    }

    // Recorded only after the flow succeeds — a failed turn must not be billed
    // against the user's allowance.
    await recordUsage(uid, result.totalTokens);

    // After recordUsage, so the log line is never written for a turn whose
    // cost failed to register against the allowance.
    recordTurn({
      ...turnContext,
      outcome: "ok",
      model: COACH_MODEL,
      thinkingLevel: COACH_THINKING_LEVEL,
      totalTokens: result.totalTokens,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      thoughtsTokens: result.thoughtsTokens,
      latencyMs: result.latencyMs,
      toolCalls: result.toolCalls,
      hasProgram: Boolean(result.program),
      usedFallbackReply: result.usedFallbackReply,
    });

    // Only the reply, the proposed program, and the usage figures cross the
    // wire. Never token counts, never cost.
    //
    // The usage fields are the same three getUsagePercentage returns, so the
    // app can drop this straight into the cache it already holds rather than
    // merging a partial update into it.
    return {
      reply: result.reply,
      ...(result.program && { program: result.program }),
      percentUsed: toPercentUsed(
        quota.tokensUsed + result.totalTokens,
        quota.cap,
      ),
      resetsAt: toIso(quota.resetsAt),
      tier: quota.tier,
    };
  },
);

/**
 * The name is now narrower than what this returns — it answers the whole
 * allowance question, not just the percentage. Renaming it would orphan the
 * deployed function until someone deletes it by hand, so the name is left
 * alone until the RevenueCat deploy makes that cleanup worth doing anyway.
 */
export const getUsagePercentage = onCall(
  // No `secrets` binding, unlike chatWithCoach above, and the asymmetry is
  // deliberate rather than an oversight: this callable only reads Firestore and
  // never reaches Gemini, so mounting the key here would hand it to a function
  // with no use for it.
  { region: REGION, maxInstances: 10 },
  async (request: CallableRequest): Promise<AiUsageResponse> => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "You must be signed in.");
    }

    // spendRateToken: false — this is a read, not a turn. The app calls it
    // every time the chat box opens, so charging it against the rate-limit
    // bucket would let a user lock themselves out of the coach by opening and
    // closing the chat five times without ever sending a message.
    //
    // It also OPENS a free user's first period as a side effect, which is why
    // a user who has never messaged the coach still gets a real reset date.
    const quota = await checkQuota(uid, new Date(), { spendRateToken: false });

    return {
      percentUsed: toPercentUsed(quota.tokensUsed, quota.cap),
      resetsAt: toIso(quota.resetsAt),
      tier: quota.tier,
    };
  },
);
