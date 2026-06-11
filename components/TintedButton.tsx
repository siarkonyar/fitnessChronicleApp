import { Colors } from "@/constants/Colors";
import React, { ReactNode } from "react";
import {
  Pressable,
  Text,
  useColorScheme,
  type PressableProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";

export type TintedButtonProps = Omit<PressableProps, "children"> & {
  textStyle?: TextStyle;
  children: ReactNode;
};

export function TintedButton({
  style,
  textStyle,
  children,
  disabled = false,
  ...rest
}: TintedButtonProps) {
  const theme = useColorScheme() ?? "light";

  return (
    <Pressable
      className={`items-center justify-center rounded-2xl border px-3.5 py-2 active:opacity-70 ${disabled ? "opacity-50" : ""}`}
      style={[
        {
          backgroundColor: `${Colors[theme].highlight}18`,
          borderColor: `${Colors[theme].highlight}30`,
        },
        style as ViewStyle,
      ]}
      disabled={disabled}
      {...rest}
    >
      <Text
        className="text-sm font-semibold"
        style={[{ color: Colors[theme].highlight }, textStyle]}
      >
        {children}
      </Text>
    </Pressable>
  );
}
