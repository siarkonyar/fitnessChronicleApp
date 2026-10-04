import { ThemedText } from "@/components/ThemedText";
import { Skeleton } from "@/components/ui/Skeleton";
import SubscriptionBadge from "@/components/ui/SubscriptionBadge";
import { Colors } from "@/constants/Colors";
import {
  TIER_BORDER_ALPHA,
  TIER_CONFIG,
  TIER_GRADIENT_ALPHA,
} from "@/constants/subscriptionTiers";
import { useColorScheme } from "@/hooks/useColorScheme";
import { aiUsageQueryOptions } from "@/lib/ai/aiUsageQuery";
import { toPlanCardState, type PlanSummary } from "@/lib/planSummary";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, View } from "react-native";

/**
 * The user's plan and AI coach allowance, at the top of Settings.
 *
 * Reads the same shared query the chat already runs, so it costs no extra
 * request, and never shows "Free" before the server has said so: a first
 * load is a skeleton, not a free-tier guess.
 */
export default function PlanUsageCard() {
  const { data, isFetching } = useQuery(aiUsageQueryOptions());
  const state = toPlanCardState(data, isFetching, new Date());

  switch (state.kind) {
    case "content":
      return <PlanCardContent summary={state.summary} />;
    case "loading":
      return <PlanCardSkeleton />;
    case "error":
      return <PlanCardError />;
  }
}

interface CardShellProps {
  /** A tier colour for the glow; omitted for the neutral loading/error card. */
  accent?: string;
  accessibilityLabel?: string;
  children: React.ReactNode;
}

/** Style A: the badge's gradient and border, scaled up to a card. */
function CardShell({ accent, accessibilityLabel, children }: CardShellProps) {
  const theme = useColorScheme() ?? "light";

  return (
    <View
      className="rounded-3xl overflow-hidden border p-4 mb-1"
      style={{
        backgroundColor: Colors[theme].elevation,
        borderColor: accent
          ? `${accent}${TIER_BORDER_ALPHA}`
          : Colors[theme].cardBorderColor,
      }}
      accessible={accessibilityLabel !== undefined}
      accessibilityLabel={accessibilityLabel}
    >
      {accent && (
        <LinearGradient
          colors={[
            `${accent}${TIER_GRADIENT_ALPHA.start}`,
            `${accent}${TIER_GRADIENT_ALPHA.end}`,
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      {children}
    </View>
  );
}

function PlanCardContent({ summary }: { summary: PlanSummary }) {
  const theme = useColorScheme() ?? "light";
  const accent = Colors[theme][TIER_CONFIG[summary.tier].accentToken];

  return (
    <CardShell accent={accent}>
      <View className="flex-row items-center justify-between">
        <SubscriptionBadge />
        <ThemedText type="defaultSemiBold">{summary.title}</ThemedText>
      </View>

      <View className="flex-row items-baseline mt-4">
        <ThemedText className="text-4xl font-['Inter-Bold']">
          {summary.percentUsed}%
        </ThemedText>
        <ThemedText
          className="text-sm ml-2"
          lightColor={Colors.light.mutedText}
          darkColor={Colors.dark.mutedText}
        >
          of AI coach used
        </ThemedText>
      </View>

      <View
        className="h-2 mt-3 overflow-hidden rounded-full"
        style={{ backgroundColor: Colors[theme].inputBackground }}
      >
        <View
          className="h-full rounded-full"
          style={{ width: `${summary.percentUsed}%`, backgroundColor: accent }}
        />
      </View>

      <View className="mt-3">
        {summary.resetsOn && <PlanRow label="Resets" value={summary.resetsOn} />}
        {summary.activeUntil && (
          <PlanRow label="Active until" value={summary.activeUntil} />
        )}
      </View>
    </CardShell>
  );
}

function PlanRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between mt-1">
      <ThemedText
        className="text-sm"
        lightColor={Colors.light.mutedText}
        darkColor={Colors.dark.mutedText}
      >
        {label}
      </ThemedText>
      <ThemedText className="text-sm">{value}</ThemedText>
    </View>
  );
}

/** Same layout and height as the content, so nothing jumps on arrival. */
function PlanCardSkeleton() {
  return (
    <CardShell accessibilityLabel="Loading your plan">
      <View className="flex-row items-center justify-between">
        <Skeleton className="h-6 w-[54px] rounded-xl" />
        <Skeleton className="h-4 w-24 rounded-md" />
      </View>
      <Skeleton className="h-9 w-40 rounded-lg mt-4" />
      <Skeleton className="h-2 w-full rounded-full mt-3" />
      <View className="mt-3">
        <Skeleton className="h-4 w-full rounded-md mt-1" />
        <Skeleton className="h-4 w-full rounded-md mt-1" />
      </View>
    </CardShell>
  );
}

function PlanCardError() {
  return (
    <CardShell>
      <ThemedText
        lightColor={Colors.light.mutedText}
        darkColor={Colors.dark.mutedText}
      >
        Couldn&apos;t load your plan
      </ThemedText>
    </CardShell>
  );
}
