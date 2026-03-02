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
  type?: "default" | "danger" | "success";
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
        type === "default" && styles.primaryButton,
        type === "danger" && styles.dangerButton,
        type === "success" && styles.successButton,
        style as ViewStyle,
      ]}
      className="bg-blue-600/70 p-2 rounded-full ml-2 active:opacity-70"
      {...rest}
    >
      <Feather
        name={icon}
        size={20}
        style={[
          styles.baseText,
          type === "default" && styles.primaryText,
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
  pressed: {
    opacity: 0.7,
  },
  baseText: {
    // default text color fallback
    color: "#000",
  },
  primaryButton: {
    backgroundColor: `${Colors.light.accentBlue}40`,
  },
  primaryText: {
    color: Colors.light.accentBlue, // white text
    fontWeight: "600",
  },
  successText: {
    color: Colors.light.success, // white text
    fontWeight: "600",
  },
  successButton: {
    backgroundColor: `${Colors.light.success}40`, // light red background
  },
  dangerButton: {
    backgroundColor: `${Colors.light.danger}40`, // light red background
  },
  dangerText: {
    color: Colors.light.danger, // solid red text
    fontWeight: "600",
  },
});
