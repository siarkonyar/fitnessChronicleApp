import { Colors } from "@/constants/Colors";
import React, { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
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
  const theme = useColorScheme() ?? "light";

  return (
    <Pressable
      style={[
        styles.baseButton,
        type === "default" && {
          backgroundColor: Colors[theme].cardBackground,
          borderColor: Colors[theme].cardBorderColor,
        },
        type === "danger" && {
          backgroundColor: Colors[theme].danger,
          borderColor: Colors[theme].danger,
        },
        type === "primary" && {
          backgroundColor: Colors[theme].highlight,
          borderColor: Colors[theme].highlight,
        },
        style as ViewStyle,
      ]}
      className="active:opacity-70"
      {...rest}
    >
      <Text
        style={[
          styles.baseText,
          type === "default" && {
            color: Colors[theme].highlight,
          },
          type === "danger" && styles.inverseText,
          type === "primary" && styles.inverseText,
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
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    elevation: 4,
  },
  baseText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
  },
  inverseText: {
    color: "#FFFFFF",
  },
});
