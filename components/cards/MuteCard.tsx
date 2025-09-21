import { type ThemedViewProps } from "@/components/ThemedView";
import React from "react";
import { TouchableOpacity } from "react-native";

type MutedCardProps = React.PropsWithChildren<ThemedViewProps> & {
  className?: string;
  onPress?: () => void;
};

export default function MutedCard({
  children,
  className,
  onPress,
  style,
  ...otherProps
}: MutedCardProps) {
  const { onBlur, onFocus, ...touchableProps } = otherProps as any;

  return (
    <TouchableOpacity
      className={`flex-row items-center p-4 border border-gray-200/50 dark:border-gray-600/50 rounded-xl active:scale-95 transition-transform shadow-sm${className ? ` ${className}` : ""}`}
      activeOpacity={1}
      {...touchableProps}
      onPress={onPress}
    >
      {children}
    </TouchableOpacity>
  );
}
