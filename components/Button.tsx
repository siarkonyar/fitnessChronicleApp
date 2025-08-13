import React, { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";

export type ButtonProps = Omit<PressableProps, "children"> & {
  type?: "default" | "danger" | "primary";
  textStyle?: TextStyle;
  children: ReactNode;
};

export function Button({
  style,
  type = "default",
  textStyle,
  children,
  ...rest
}: ButtonProps) {
  return (
    <Pressable
      style={[
        styles.baseButton,
        type === "default" && styles.defaultButton,
        type === "danger" && styles.dangerButton,
        type === "primary" && styles.primaryButton,
        style as ViewStyle,
      ]}
      className="active:opacity-70"
      {...rest}
    >
      <Text
        style={[
          styles.baseText,
          type === "default" && styles.default,
          type === "danger" && styles.dangerText,
          type === "primary" && styles.primaryText,
          textStyle,
        ]}
      >
        {children}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  baseButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
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
  defaultButton: {
    backgroundColor: "#FF8C0040", // light green background
  },
  default: {
    fontSize: 16,
    lineHeight: 24,
    color: "#FF8C00", // fully opaque green text
    fontWeight: "600",
  },
  primaryButton: {
    backgroundColor: "#4CCC0040", // blue background
  },
  primaryText: {
    fontSize: 16,
    lineHeight: 24,
    color: "#4CCC00", // white text
    fontWeight: "600",
  },
  dangerButton: {
    backgroundColor: "#FF000040", // light red background
  },
  dangerText: {
    fontSize: 16,
    lineHeight: 24,
    color: "#FF0000", // solid red text
    fontWeight: "600",
  },
});
