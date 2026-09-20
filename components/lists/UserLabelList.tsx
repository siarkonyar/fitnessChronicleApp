import React from "react";
import Card from "../Card";
import { ThemedText } from "../ThemedText";
import { ThemedView } from "../ThemedView";
import LabelList from "./LabelList";

export default function UserLabelList({
  labelOnPress,
}: {
  labelOnPress: (labelId: string) => void | Promise<void>;
}) {
  return (
    <Card>
      <ThemedView className="mb-2">
        <ThemedText type="label">LABELS</ThemedText>
        <ThemedText type="subtitle">Your Label Collection</ThemedText>
      </ThemedView>
      <LabelList labelOnPress={labelOnPress} />
    </Card>
  );
}
