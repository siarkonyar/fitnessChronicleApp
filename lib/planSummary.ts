import {
  TIER_CONFIG,
  type SubscriptionTier,
} from "@/constants/subscriptionTiers";
import { AiUsageSchema, type AiUsage } from "@/lib/ai/coachServer";

/** Everything the plan card prints, already worded. */
export interface PlanSummary {
  tier: SubscriptionTier;
  title: string;
  percentUsed: number;
  /** Null hides the "Resets" row. */
  resetsOn: string | null;
  /** Null hides the "Active until" row. */
  activeUntil: string | null;
}

export type PlanCardState =
  | { kind: "content"; summary: PlanSummary }
  | { kind: "loading" }
  | { kind: "error" };

/**
 * Fixed English month names rather than toLocaleDateString: the app's copy is
 * English, and locale data differs between Hermes, iOS and Node — en-GB even
 * spells September "Sept" on some of them.
 */
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "14 Oct" this year, "3 Nov 2027" any other. Local time. */
const formatPlanDate = (iso: string, now: Date): string => {
  const date = new Date(iso);
  const dayMonth = `${date.getDate()} ${MONTHS[date.getMonth()]}`;

  return date.getFullYear() === now.getFullYear()
    ? dayMonth
    : `${dayMonth} ${date.getFullYear()}`;
};

const titleFor = (usage: AiUsage): string => {
  if (usage.tier === "free") return "Free plan";

  const { name } = TIER_CONFIG[usage.tier];
  return usage.billingPeriod ? `${name} ${usage.billingPeriod}` : name;
};

export const toPlanSummary = (usage: AiUsage, now: Date): PlanSummary => ({
  tier: usage.tier,
  title: titleFor(usage),
  percentUsed: usage.percentUsed,
  resetsOn: usage.resetsAt === null ? null : formatPlanDate(usage.resetsAt, now),
  // A free plan never expires, whatever else arrived with it.
  activeUntil:
    usage.tier === "free" || usage.activeUntil === null
      ? null
      : formatPlanDate(usage.activeUntil, now),
});

/**
 * Which of the card's three faces to show.
 *
 * `data` is unknown on purpose: the persisted cache can hold a bare number
 * written by a build from before this endpoint returned an object. Anything
 * that does not parse is treated as "no data" — a skeleton while a fetch is
 * running, the error card once none is.
 */
export const toPlanCardState = (
  data: unknown,
  isFetching: boolean,
  now: Date,
): PlanCardState => {
  const parsed = AiUsageSchema.safeParse(data);

  if (parsed.success) {
    return { kind: "content", summary: toPlanSummary(parsed.data, now) };
  }

  return isFetching ? { kind: "loading" } : { kind: "error" };
};
