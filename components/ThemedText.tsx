import { StyleSheet, Text, type TextProps } from "react-native";

import { useThemeColor } from "@/hooks/useThemeColor";

export type ThemedTextType =
  | "default"
  | "title"
  | "defaultSemiBold"
  | "subtitle"
  | "link"
  | "label";

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: ThemedTextType;
};

const TYPE_CLASS_NAMES: Record<ThemedTextType, string> = {
  default: "",
  defaultSemiBold: "font-semibold",
  title: "text-2xl font-['Inter-Bold']",
  subtitle: "text-xl font-bold",
  link: "",
  label: "font-sans uppercase tracking-[3.5px] opacity-60",
};

const TYPE_LINE_HEIGHTS: Record<ThemedTextType, number | undefined> = {
  default: undefined,
  defaultSemiBold: undefined,
  title: undefined,
  subtitle: undefined,
  link: undefined,
  label: undefined,
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = "default",
  className,
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, "text");

  return (
    <Text
      style={[
        { color, lineHeight: TYPE_LINE_HEIGHTS[type] },
        type === "link" ? styles.link : undefined,
        style,
      ]}
      className={["py-1", TYPE_CLASS_NAMES[type], className]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  link: {
    color: "#0a7ea4",
  },
});
