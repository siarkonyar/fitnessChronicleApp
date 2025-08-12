import { ThemedView, type ThemedViewProps } from "@/components/ThemedView";
import React from "react";

type CardProps = React.PropsWithChildren<ThemedViewProps> & {
  className?: string;
};

export default function Card({
  children,
  className,
  style,
  ...otherProps
}: CardProps) {
  return (
    <ThemedView
      className={`w-full shadow-md shadow-gray-900 p-3 rounded-lg mb-3${className ? ` ${className}` : ""}`}
      style={style}
      {...otherProps}
    >
      {children}
    </ThemedView>
  );
}
