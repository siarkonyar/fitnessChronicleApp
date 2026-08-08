import Card from "@/components/Card";
import ProgramDayCard from "@/components/cards/ProgramDayCard";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { TintedButton } from "@/components/TintedButton";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { ProgramSchema } from "@/types/types";
import React from "react";
import { z } from "zod";

type Program = z.infer<typeof ProgramSchema>;

interface ProgramProposalCardProps {
  program: Program;
  onAccept: () => void;
  onRegenerate: () => void;
  isDisabled?: boolean;
}

export default function ProgramProposalCard({
  program,
  onAccept,
  onRegenerate,
  isDisabled,
}: ProgramProposalCardProps) {
  const theme = useColorScheme() ?? "light";
  const palette = Colors[theme];

  const dayCount = program.days.length;
  const trainingDayCount = program.days.filter((day) => !day.isRestDay).length;

  return (
    <Card>
      <ThemedView className="mb-4">
        <ThemedText
          className="text-xs font-bold tracking-widest"
          style={{ color: palette.highlight }}
        >
          PROPOSED PROGRAM
        </ThemedText>
        <ThemedText className="text-xl font-bold" numberOfLines={2}>
          {program.name}
        </ThemedText>
        <ThemedText className="text-sm" style={{ color: palette.mutedText }}>
          {dayCount} {dayCount === 1 ? "day" : "days"} · {trainingDayCount}{" "}
          training
        </ThemedText>
      </ThemedView>

      {program.days.map((day, index) => (
        <ProgramDayCard key={index} index={index} day={day} />
      ))}

      <ThemedView
        className="flex-row gap-3 pt-4 border-t"
        style={{ borderTopColor: palette.separator }}
      >
        <ThemedView className="flex-1">
          <TintedButton onPress={onRegenerate} disabled={isDisabled}>
            Regenerate
          </TintedButton>
        </ThemedView>
        <ThemedView className="flex-1">
          <TintedButton
            onPress={onAccept}
            disabled={isDisabled}
            style={{
              backgroundColor: palette.highlight,
              borderColor: palette.highlight,
            }}
            textStyle={{ color: palette.background }}
          >
            Accept
          </TintedButton>
        </ThemedView>
      </ThemedView>
    </Card>
  );
}
