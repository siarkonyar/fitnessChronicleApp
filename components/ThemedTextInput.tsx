import { forwardRef } from "react";
import { TextInput, type TextInputProps } from "react-native";

import { useThemeColor } from "@/hooks/useThemeColor";

export type ThemedTextInputProps = TextInputProps & {
  lightColor?: string;
  darkColor?: string;
};

export const ThemedTextInput = forwardRef<TextInput, ThemedTextInputProps>(
  function ThemedTextInput({ style, lightColor, darkColor, ...otherProps }, ref) {
    const color = useThemeColor({ light: lightColor, dark: darkColor }, "text");
    return <TextInput ref={ref} style={[{ color }, style]} {...otherProps} />;
  },
);
