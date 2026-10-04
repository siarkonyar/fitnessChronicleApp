/**
 * EMULATOR ONLY: give an emulator user a paid plan, to test the plan card and
 * paid caps without a real purchase.
 *
 * It writes the document the RevenueCat extension would write, and nothing
 * else. The onRevenueCatCustomerWritten trigger running in the Functions
 * emulator then does the real work, so this exercises the same path a real
 * purchase takes.
 *
 * Run (with `npm run emulators` up, from the repo root):
 *   npm --prefix functions run seed:plan -- <uid> [pro|max] [monthly|yearly]
 *
 * The uid is the emulator user's, from Emulator UI → Authentication.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { BillingPeriod } from "../src/revenuecat/billingPeriod.js";

const PAID_TIERS = ["pro", "max"] as const;
const BILLING_PERIODS = ["monthly", "yearly"] as const;

type PaidTier = (typeof PAID_TIERS)[number];

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const PERIOD_LENGTH_DAYS: Record<BillingPeriod, number> = {
  monthly: 30,
  yearly: 365,
};

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

// The whole point of the guard: without this variable the Admin SDK would
// write to the LIVE project.
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  fail(
    "FIRESTORE_EMULATOR_HOST is not set, refusing to run against production.\n" +
      "Use `npm --prefix functions run seed:plan -- <uid>`, which sets it.",
  );
}

const isPaidTier = (value: string): value is PaidTier =>
  (PAID_TIERS as readonly string[]).includes(value);

const isBillingPeriod = (value: string): value is BillingPeriod =>
  (BILLING_PERIODS as readonly string[]).includes(value);

const [uid, tier = "pro", period = "monthly"] = process.argv.slice(2);

if (!uid) fail("Usage: seed:plan -- <uid> [pro|max] [monthly|yearly]");
if (!isPaidTier(tier)) fail(`Unknown tier "${tier}", use pro or max.`);
if (!isBillingPeriod(period)) {
  fail(`Unknown period "${period}", use monthly or yearly.`);
}

/** The emulator runs in singleProjectMode under the project in .firebaserc. */
const readProjectId = (): string => {
  const firebaserc = JSON.parse(
    readFileSync(join(__dirname, "..", "..", ".firebaserc"), "utf8"),
  ) as { projects?: { default?: string } };

  return firebaserc.projects?.default ?? fail("No default project in .firebaserc");
};

const seedPlan = async (
  appUserId: string,
  paidTier: PaidTier,
  billingPeriod: BillingPeriod,
): Promise<void> => {
  // Loaded only now, past the guard: importing it initialises the Admin app,
  // which reads the project from GCLOUD_PROJECT.
  process.env.GCLOUD_PROJECT ??= readProjectId();
  const { db, REVENUECAT_CUSTOMERS_COLLECTION } = await import(
    "../src/data/firestore.js"
  );

  const now = Date.now();
  const expiresAt = now + PERIOD_LENGTH_DAYS[billingPeriod] * MS_PER_DAY;
  // Ends in _monthly / _yearly, which is how billingPeriod.ts reads the period.
  const productId = `hercule_${paidTier}_${billingPeriod}`;

  await db
    .collection(REVENUECAT_CUSTOMERS_COLLECTION)
    .doc(appUserId)
    .set({
      entitlements: {
        [paidTier]: {
          product_identifier: productId,
          purchase_date: new Date(now).toISOString(),
          expires_date: new Date(expiresAt).toISOString(),
          grace_period_expires_date: null,
        },
      },
      subscriptions: {
        [productId]: { is_sandbox: true, store: "app_store" },
      },
    });

  console.log(
    `Wrote a ${paidTier} ${billingPeriod} plan for ${appUserId}. ` +
      "The trigger applies it to aiUsage in a moment; pull to refresh the app.",
  );
};

seedPlan(uid, tier as PaidTier, period as BillingPeriod).catch((error: unknown) =>
  fail(`Seeding failed: ${error instanceof Error ? error.message : String(error)}`),
);
