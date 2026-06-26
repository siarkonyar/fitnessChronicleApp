import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import React, { ReactNode } from "react";
import { TouchableOpacity, TouchableOpacityProps } from "react-native";

type PillButtonColor = keyof typeof Colors.light;

interface PillButtonProps extends TouchableOpacityProps {
  color: PillButtonColor;
  children: ReactNode;
}

export default function PillButton({
  color,
  className,
  children,
  ...rest
}: PillButtonProps) {
  const theme = useColorScheme() ?? "light";
  const tint = Colors[theme][color];

  return (
    <TouchableOpacity
      className={`flex-row items-center justify-center gap-1 px-3 py-1 rounded-full active:opacity-70 ${className ?? ""}`}
      style={{ backgroundColor: `${tint}22` }}
      {...rest}
    >
      {children}
    </TouchableOpacity>
  );
}
