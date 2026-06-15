import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Colors } from "@/constants/Colors";
import { useActiveProgramContext } from "@/context/ActiveProgramContext";
import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { Modal, Pressable, View, useColorScheme } from "react-native";
import { Button } from "./Button";
import MutedCard from "./cards/MuteCard";
import IconBadge from "./ui/IconBadge";

export default function ChooseProgramDay() {
  const theme = useColorScheme() ?? "light";
  const [isOpen, setIsOpen] = useState(false);
  const { activeProgram, programDay, selectProgramDay } =
    useActiveProgramContext();

  function handleSelectDay(dayIndex: number) {
    selectProgramDay(dayIndex, {
      onSuccess: () => setIsOpen(false),
    });
  }

  const currentDay =
    programDay !== undefined ? activeProgram?.days[programDay] : undefined;

  return (
    <>
      <View>
        <ThemedText type="label" className="mb-1 ml-1">
          {programDay !== undefined ? `Day ${programDay + 1}` : "No day selected"}
        </ThemedText>

        <MutedCard onPress={() => setIsOpen(true)}>
          <IconBadge className="mr-4">
            <ThemedText style={{ fontSize: 24, lineHeight: 28 }}>
              {currentDay?.isRestDay
                ? "💤"
                : (currentDay?.label?.label ?? "?")}
            </ThemedText>
          </IconBadge>

          <ThemedView className="flex-1 min-w-0">
            <ThemedText className="text-base font-semibold" numberOfLines={1}>
              {currentDay?.isRestDay
                ? "Rest day"
                : (currentDay?.label?.description ?? "Choose a day")}
            </ThemedText>
            <ThemedText
              lightColor={Colors.light.mutedText}
              darkColor={Colors.dark.mutedText}
              style={{ fontSize: 13 }}
              numberOfLines={1}
            >
              {activeProgram?.name.toUpperCase() ?? "No active program"}
            </ThemedText>
          </ThemedView>

          <Feather
            name="chevron-right"
            size={18}
            color={Colors[theme].mutedText}
          />
        </MutedCard>
      </View>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <View className="flex-1 items-center justify-center px-4 bg-black">
          <ThemedView className="w-11/12 max-w-md mx-4">
            <ThemedText className="font-bold mb-2 text-center">
              Choose a Day
            </ThemedText>

            {/* TODO 3 — list activeProgram.days, each row Pressable -> handleSelectDay(index) */}

            <Button type="danger" onPress={() => setIsOpen(false)}>
              Cancel
            </Button>
          </ThemedView>
        </View>
      </Modal>
    </>
  );
}
