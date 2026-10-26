import { Colors } from "@/constants/Colors";
import { View } from "react-native";
import { useColorScheme } from "@/hooks/useColorScheme";

export function RowDivider() {
  const theme = useColorScheme() ?? "light";

  return (
    <View
      className="h-px ml-[60px]"
      style={{ backgroundColor: Colors[theme].cardBorderColor }}
    />
  );
}
