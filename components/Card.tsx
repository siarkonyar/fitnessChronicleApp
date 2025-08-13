import { ThemedView, type ThemedViewProps } from "@/components/ThemedView";
import { Colors } from "@/constants/Colors";
import React from "react";
import { useColorScheme } from "react-native";

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
  return (
    <ThemedView
      style={{
        borderColor: Colors[theme].highlight,
      }}
      className={`w-full border p-3 rounded-lg mb-3${className ? ` ${className}` : ""}`}
      {...otherProps}
    >
      {children}
    </ThemedView>
  );
}
