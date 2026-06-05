import { Colors } from "@/constants/Colors";
import { queryKeys } from "@/constants/QueryKeys";
import { useColorScheme } from "@/hooks/useColorScheme";
import { getAllLabels } from "@/lib/firebase/label";
import { LabelSchema, LabelWithIdSchema, ProgramDaySchema } from "@/types/types";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  TouchableOpacity,
  View,
} from "react-native";
import { z } from "zod";
import { Button } from "../Button";
import Card from "../Card";
import UserLabelList from "../lists/UserLabelList";
import { ThemedText } from "../ThemedText";
import { ThemedView } from "../ThemedView";
import LabelBadge from "../ui/LabelBadge";

type ProgramDay = z.infer<typeof ProgramDaySchema>;
type Label = z.infer<typeof LabelSchema>;
type LabelWithId = z.infer<typeof LabelWithIdSchema>;

interface AddProgramDayCardProps {
  index: number;
  day: ProgramDay;
  onSelectLabel: (label: Label) => void;
  className?: string;
}

export default function AddProgramDayCard({
  index,
  day,
  onSelectLabel,
  className,
}: AddProgramDayCardProps) {
  const theme = useColorScheme() ?? "light";
  const [isLabelSelectionOpen, setIsLabelSelectionOpen] = useState(false);

  const { data: labels } = useQuery({
    queryKey: queryKeys.labels.all,
    queryFn: () => getAllLabels(),
  });

  const exerciseCount = day.exercises?.length ?? 0;
  const subtitle = day.isRestDay
    ? "Rest Day"
    : exerciseCount > 0
      ? `${exerciseCount} exercise${exerciseCount !== 1 ? "s" : ""}`
      : "No exercises";

  function handleSelectLabel(labelId: string) {
    const found = (labels as LabelWithId[] | undefined)?.find(
      (item) => item.id === labelId,
    );
    if (!found) return;
    const { id, ...label } = found;
    onSelectLabel(label);
    setIsLabelSelectionOpen(false);
  }

  return (
    <>
      <Card className={className}>
        <ThemedView className="flex-row items-center flex-1 min-w-0">
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setIsLabelSelectionOpen(true)}
            className="mr-4"
          >
            <LabelBadge>
              {day.label ? (
                <ThemedText style={{ fontSize: 24 }}>
                  {day.label.label}
                </ThemedText>
              ) : (
                <Feather name="plus" size={22} color={Colors[theme].highlight} />
              )}
            </LabelBadge>
          </TouchableOpacity>
          <ThemedView className="flex-col flex-1 min-w-0">
            <ThemedText className="text-base font-semibold">
              {day.label ? day.label.description : "Choose a label"}
            </ThemedText>
            <ThemedText
              className="text-sm"
              lightColor={Colors.light.mutedText}
              darkColor={Colors.dark.mutedText}
            >
              {subtitle}
            </ThemedText>
          </ThemedView>
        </ThemedView>
      </Card>

      <Modal
        visible={isLabelSelectionOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsLabelSelectionOpen(false)}
      >
        <KeyboardAvoidingView
          keyboardVerticalOffset={-90}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          <View className="flex-1 items-center justify-center px-4 bg-black backdrop-blur-sm">
            <ThemedView className="w-11/12 max-w-md mx-4">
              <ThemedText className="text-2xl font-bold mb-2 text-center">
                Choose a Label
              </ThemedText>
              <ThemedText className="text-sm opacity-70 text-center mb-6">
                Day {index + 1}
              </ThemedText>
              <UserLabelList labelOnPress={handleSelectLabel} />
              <Button
                type="danger"
                onPress={() => setIsLabelSelectionOpen(false)}
              >
                Cancel
              </Button>
            </ThemedView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
