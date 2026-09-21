import { getAuth } from "firebase-admin/auth";
import { Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { region } from "firebase-functions/v1";
import { aiUsageDoc } from "../data/firestore.js";
import { freePeriodEnd } from "../quota/period.js";

/**
 * Spelled out rather than imported from index.ts.
 *
 * index.ts re-exports this trigger, so importing REGION back out of it would
 * be a cycle. deleteAiUsage.ts and recordConsentChange.ts hardcode the same
 * string for the same reason.
 */
const TRIGGER_REGION = "europe-west2";

/** Firestore's ALREADY_EXISTS. A create() that loses a race reports this. */
const ALREADY_EXISTS = 6;

/**
 * Starts a new user's free allowance the moment their account exists.
 *
 * WHY A TRIGGER RATHER THAN LEAVING IT TO checkQuota
 *
 * checkQuota already creates this document on first contact, and still does —
 * see the rollover branch in quota/check.ts. That lazy path is what makes this
 * change need no migration: every user who predates this trigger simply gets a
 * document the next time they touch the coach.
 *
 * What the lazy path cannot do is start the clock at the right moment. Created
 * lazily, a user's 30 days begin whenever they first open the chat — so two
 * people who signed up the same day can have allowances that reset three weeks
 * apart, and anyone who has never opened the coach has no reset date to show
 * at all. Creating it at signup makes "your allowance resets on the 14th" a
 * fact about the account rather than about when someone happened to tap.
 *
 * DELIBERATELY NOT RETRIED, and errors are swallowed rather than rethrown.
 * This is an optimisation over a path that already works: if it fails, the
 * user gets their document on first contact exactly as before, a few days'
 * difference in a reset date and nothing else. Retrying a write whose only
 * effect is to zero a counter and push a date outwards is a worse failure than
 * skipping it — a retry that lands after the user has spent tokens would give
 * them their allowance back.
 */
export const onUserCreated = region(TRIGGER_REGION)
  .auth.user()
  .onCreate(async (user) => {
    const { uid } = user;

    try {
      // Confirm the account still exists before writing anything.
      //
      // This trigger is a background function that can cold-start seconds
      // after signup. Without this check, an account created and deleted
      // inside that window gets its usage document written AFTER
      // onUserDeleted has already removed it — resurrecting exactly the
      // orphan that trigger exists to prevent. Inherently still a race, but
      // it closes the realistic version of it, and the cost is one lookup
      // per account for the lifetime of that account.
      await getAuth().getUser(uid);

      // create(), not set(): it fails rather than overwrites if a document is
      // somehow already there, which keeps this from wiping a counter that the
      // lazy path created microseconds earlier in a race.
      await aiUsageDoc(uid).create({
        tokensUsed: 0,
        periodEnd: Timestamp.fromMillis(freePeriodEnd(Date.now())),
        tier: "free",
      });

      logger.info("Opened free AI usage period at signup", { uid });
    } catch (error) {
      if ((error as { code?: number }).code === ALREADY_EXISTS) return;

      // The account was deleted between signup and this invocation. Nothing to
      // open a period for, and nothing worth logging as a failure.
      if ((error as { code?: string }).code === "auth/user-not-found") return;

      logger.error("Failed to open AI usage period at signup", { uid, error });
    }
  });
