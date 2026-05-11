import { Colors } from "@/constants/Colors";
import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  Pressable,
  StyleSheet,
  type PressableProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";

export type RoundedButtonProps = Omit<PressableProps, "children"> & {
  type?: "default" | "blue" | "danger" | "success";
  textStyle?: TextStyle;
  icon: keyof typeof Feather.glyphMap;
  onPress?: (id: string) => void;
};

export function RoundedButton({
  style,
  type = "default",
  icon,
  textStyle,
  onPress,
  ...rest
}: RoundedButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.baseButton,
        type === "default" && styles.defaultButton,
        type === "blue" && styles.blueButton,
        type === "danger" && styles.dangerButton,
        type === "success" && styles.successButton,
        style as ViewStyle,
      ]}
      className="p-2 rounded-full ml-1 active:opacity-70"
      {...rest}
    >
      <Feather
        name={icon}
        size={20}
        style={[
          styles.baseText,
          type === "default" && styles.defaultText,
          type === "blue" && styles.blueText,
          type === "danger" && styles.dangerText,
          type === "success" && styles.successText,
          textStyle,
        ]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  baseButton: {
    alignItems: "center",
    justifyContent: "center",
  },
  baseText: {
    color: "#000",
  },
  defaultButton: {
    backgroundColor: Colors.light.highlight,
  },
  defaultText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  blueButton: {
    backgroundColor: `${Colors.light.accentBlue}40`,
  },
  blueText: {
    color: Colors.light.accentBlue,
    fontWeight: "600",
  },
  successButton: {
    backgroundColor: `${Colors.light.success}40`,
  },
  successText: {
    color: Colors.light.success,
    fontWeight: "600",
  },
  dangerButton: {
    backgroundColor: `${Colors.light.danger}40`,
  },
  dangerText: {
    color: Colors.light.danger,
    fontWeight: "600",
  },
});
