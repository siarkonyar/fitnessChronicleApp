/**
 * Read-only summary of the aiUsage collection.
 *
 * This exists because analytics is not retroactive. GA4 and the aiTurns
 * collection both start empty on the day they ship, but aiUsage/{uid} has been
 * accumulating real token totals since the coach launched — it is the only
 * historical view of AI usage that exists, so it is worth reading before
 * anything new is instrumented.
 *
 * What it CANNOT tell you, because aiUsage never recorded it: how many turns a
 * user took, which tools ran, how long anything took, or the input/output/
 * thinking split. Those arrive only once functions/src/telemetry/aiTurn.ts is
 * deployed. Everything here is derived from one number per user.
 *
 * Run:
 *   gcloud auth application-default login
 *   npx tsx scripts/aiUsageReport.ts
 *
 * Writes nothing. Reads every document in aiUsage once.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import {
  MIN_HEADROOM_TOKENS,
  PERIOD_DAYS,
  capForTier,
  type Tier,
} from "../src/quota/caps.js";

/**
 * Blended cost per million TOTAL tokens, in USD.
 *
 * A guess by construction, and deliberately marked as one. aiUsage stores a
 * single totalTokens figure with no input/output split, and those two bill at
 * different rates — so no exact cost can be recovered from this data. Thinking
 * tokens bill as output, and at MINIMAL thinking on gemini-3.1-flash-lite most
 * of the total is output, which is why this leans toward the output rate.
 *
 * VERIFY against https://ai.google.dev/pricing before quoting the cost figure
 * to anyone. Once aiTurns is live the split is recorded and this constant dies.
 */
const BLENDED_USD_PER_MILLION_TOKENS = 0.4;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const TOP_USER_COUNT = 10;

interface UsageRow {
  readonly uid: string;
  readonly tokensUsed: number;
  readonly tier: Tier;
  readonly periodStart: Date | null;
}

/**
 * Narrows one raw document, or returns null.
 *
 * Mirrors how checkQuota reads the same fields: anything that is not exactly
 * "premium" is free, and a missing or non-numeric tokensUsed is zero. A doc is
 * rejected only when it has no usable shape at all, and rejections are counted
 * and reported rather than silently dropped.
 */
const toUsageRow = (
  uid: string,
  data: FirebaseFirestore.DocumentData | undefined,
): UsageRow | null => {
  if (!data) return null;

  const rawPeriodStart: unknown = data.periodStart;

  return {
    uid,
    tokensUsed: typeof data.tokensUsed === "number" ? data.tokensUsed : 0,
    tier: data.tier === "premium" ? "premium" : "free",
    periodStart:
      rawPeriodStart instanceof Timestamp ? rawPeriodStart.toDate() : null,
  };
};

/** Nearest-rank percentile over an ascending-sorted copy. */
const percentile = (sorted: readonly number[], fraction: number): number => {
  if (sorted.length === 0) return 0;

  const rank = Math.ceil(fraction * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, rank))];
};

/**
 * A user is exhausted at the point checkQuota starts refusing them, which is
 * one headroom short of the cap — not at the cap itself.
 */
const isExhausted = (row: UsageRow): boolean =>
  row.tokensUsed >= capForTier(row.tier) - MIN_HEADROOM_TOKENS;

/** Active means the period has not yet rolled, i.e. they used the coach recently. */
const isActive = (row: UsageRow, now: Date): boolean =>
  row.periodStart !== null &&
  now.getTime() - row.periodStart.getTime() < PERIOD_DAYS * MS_PER_DAY;

const usd = (tokens: number): string =>
  `$${((tokens / 1_000_000) * BLENDED_USD_PER_MILLION_TOKENS).toFixed(2)}`;

const int = (value: number): string => Math.round(value).toLocaleString("en-US");

const pct = (part: number, whole: number): string =>
  whole === 0 ? "0%" : `${Math.round((part / whole) * 100)}%`;

const line = (label: string, value: string): string =>
  `  ${label.padEnd(34)}${value}`;

const formatTopUsers = (rows: readonly UsageRow[]): string[] => {
  if (rows.length === 0) return ["  (nobody has spent a token yet)"];

  return rows.map((row, index) => {
    const rank = String(index + 1).padStart(2);
    const tokens = int(row.tokensUsed).padStart(12);
    const flag = isExhausted(row) ? "  EXHAUSTED" : "";

    return `  ${rank}. ${row.uid}  ${tokens}  ${row.tier}${flag}`;
  });
};

const buildReport = (rows: readonly UsageRow[], now: Date): string => {
  const totalTokens = rows.reduce((sum, row) => sum + row.tokensUsed, 0);
  const spenders = rows.filter((row) => row.tokensUsed > 0);
  const sorted = [...spenders].map((row) => row.tokensUsed).sort((a, b) => a - b);

  const premiumCount = rows.filter((row) => row.tier === "premium").length;
  const activeCount = rows.filter((row) => isActive(row, now)).length;
  const exhaustedCount = rows.filter(isExhausted).length;

  const mean = spenders.length === 0 ? 0 : totalTokens / spenders.length;
  const top = [...spenders]
    .sort((a, b) => b.tokensUsed - a.tokensUsed)
    .slice(0, TOP_USER_COUNT);

  return [
    "",
    "AI usage — from aiUsage/{uid}, the only historical record that exists",
    `Generated ${now.toISOString()}`,
    "",
    "USERS",
    line("With an aiUsage doc", int(rows.length)),
    line(
      "Who ever spent a token",
      `${int(spenders.length)} (${pct(spenders.length, rows.length)})`,
    ),
    line(
      `Active this period (${PERIOD_DAYS}d)`,
      `${int(activeCount)} (${pct(activeCount, rows.length)})`,
    ),
    line("Premium tier", int(premiumCount)),
    line("Free tier", int(rows.length - premiumCount)),
    line(
      "Quota-exhausted right now",
      `${int(exhaustedCount)} (${pct(exhaustedCount, rows.length)})`,
    ),
    "",
    "TOKENS (total, thinking included)",
    line("Sum across all users", int(totalTokens)),
    line("Estimated spend", `${usd(totalTokens)}  (blended guess — see header)`),
    line("Mean per spending user", int(mean)),
    line("Median per spending user", int(percentile(sorted, 0.5))),
    line("p90 per spending user", int(percentile(sorted, 0.9))),
    line("Max", int(sorted[sorted.length - 1] ?? 0)),
    "",
    `TOP ${TOP_USER_COUNT} USERS BY TOKENS`,
    ...formatTopUsers(top),
    "",
    "Counts only. aiUsage stores no message text, and none is read here.",
    "",
  ].join("\n");
};

/**
 * The project to read from.
 *
 * firebase-admin does not read .firebaserc — that file belongs to the CLI — so
 * without this the script would need GOOGLE_CLOUD_PROJECT exported by hand
 * every time. Resolving it from .firebaserc keeps the one source of truth the
 * repo already has, and the env var still wins for pointing at another project.
 */
const resolveProjectId = (): string => {
  const fromEnv =
    process.env.GOOGLE_CLOUD_PROJECT ?? process.env.GCLOUD_PROJECT;
  if (fromEnv) return fromEnv;

  // __dirname rather than import.meta.url: functions/package.json has no
  // "type": "module", so this package compiles as CommonJS and import.meta is
  // a hard compile error here.
  const rcPath = join(__dirname, "..", "..", ".firebaserc");

  const rc: unknown = JSON.parse(readFileSync(rcPath, "utf8"));
  const fromRc = (rc as { projects?: { default?: unknown } })?.projects?.default;

  if (typeof fromRc !== "string" || fromRc.length === 0) {
    throw new Error(
      `No project id: ${rcPath} has no projects.default. Set GOOGLE_CLOUD_PROJECT instead.`,
    );
  }

  return fromRc;
};

const main = async (): Promise<void> => {
  const projectId = resolveProjectId();
  initializeApp({ projectId });

  console.log(`Reading aiUsage from project ${projectId}...`);

  const snapshot = await getFirestore().collection("aiUsage").get();

  const rows: UsageRow[] = [];
  const skipped: string[] = [];

  for (const doc of snapshot.docs) {
    const row = toUsageRow(doc.id, doc.data());
    if (row) rows.push(row);
    else skipped.push(doc.id);
  }

  console.log(buildReport(rows, new Date()));

  // Surfaced, never swallowed: a doc this script cannot read is a doc the
  // quota system may also be misreading.
  if (skipped.length > 0) {
    console.warn(
      `Skipped ${skipped.length} unreadable doc(s): ${skipped.join(", ")}`,
    );
  }
};

const NO_CREDENTIALS_HINT =
  "Run: gcloud auth application-default login   (then re-run this script)";

/**
 * Prints one useful line instead of a stack trace, then stops.
 *
 * Also registered for uncaughtException and unhandledRejection, not just the
 * awaited path: a missing-credentials failure does NOT come back through the
 * promise returned by Firestore's .get(). google-gax throws it from a timer
 * tick while building the gRPC stub, so it escapes main().catch() entirely and
 * Node prints thirty lines of library internals for a one-line problem.
 */
const reportFatal = (error: unknown): void => {
  const message = error instanceof Error ? error.message : String(error);

  console.error(`\naiUsageReport failed: ${message}`);

  if (message.includes("Could not load the default credentials")) {
    console.error(NO_CREDENTIALS_HINT);
  }

  process.exit(1);
};

process.on("uncaughtException", reportFatal);
process.on("unhandledRejection", reportFatal);

main().catch(reportFatal);
