import { ThemedView, type ThemedViewProps } from "@/components/ThemedView";
import { Colors } from "@/constants/Colors";
import React from "react";
import { StyleSheet, useColorScheme } from "react-native";

type CardProps = React.PropsWithChildren<ThemedViewProps> & {
  className?: string;
};

export default function Card({
  children,
  className,
  style,
  ...otherProps
}: CardProps) {
  const theme = useColorScheme() ?? "light";
  const palette = Colors[theme];

  return (
    <ThemedView
      style={[
        styles.surface,
        {
          backgroundColor: palette.elevation,
          borderColor: palette.cardBorderColor,
          shadowColor:
            theme === "dark" ? Colors.dark.background : palette.highlight,
        },
        style,
      ]}
      className={`w-full mb-3 overflow-hidden rounded-3xl border px-4 py-4${className ? ` ${className}` : ""}`}
      {...otherProps}
    >
      {children}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  surface: {
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    elevation: 6,
  },
});
