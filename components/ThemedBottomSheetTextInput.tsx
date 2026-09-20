import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import type { TextInputProps } from "react-native";

import { useThemeColor } from "@/hooks/useThemeColor";

export type ThemedBottomSheetTextInputProps = TextInputProps & {
  lightColor?: string;
  darkColor?: string;
};

export function ThemedBottomSheetTextInput({
  style,
  lightColor,
  darkColor,
  ...otherProps
}: ThemedBottomSheetTextInputProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, "text");
  return <BottomSheetTextInput style={[{ color }, style]} {...otherProps} />;
}
