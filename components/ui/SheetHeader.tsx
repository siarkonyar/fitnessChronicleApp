import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { View } from "react-native";
import { RoundedButton } from "../RoundButton";
import IconBadge from "./IconBadge";

const ICON_SIZE = 24;

interface SheetHeaderProps {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle: string;
  onClose: () => void;
}

/**
 * The header every bottom sheet in the app opens with: a tinted icon badge, a
 * title over a muted subtitle, and a close button on the right.
 *
 * Extracted because six sheets had drifted apart while rendering the same
 * layout — some carried a badge and some didn't, and two uppercased their
 * subtitle. Keeping it in one place means a sheet can't miss the treatment.
 */
export default function SheetHeader({
  icon,
  title,
  subtitle,
  onClose,
}: SheetHeaderProps) {
  const theme = useColorScheme() ?? "light";

  return (
    <View className="flex-row items-center px-5 pb-4">
      <IconBadge className="mr-3">
        <Feather name={icon} size={ICON_SIZE} color={Colors[theme].highlight} />
      </IconBadge>
      <View className="flex-1 mr-3">
        <ThemedText className="text-xl font-bold" numberOfLines={1}>
          {title}
        </ThemedText>
        <ThemedText
          className="text-sm"
          lightColor={Colors.light.mutedText}
          darkColor={Colors.dark.mutedText}
          numberOfLines={1}
        >
          {subtitle}
        </ThemedText>
      </View>
      <RoundedButton type="danger" icon="x" onPress={onClose} />
    </View>
  );
}
