import { Colors } from "@/constants/Colors";
import { useColorScheme, View } from "react-native";

export function RowDivider() {
  const theme = useColorScheme() ?? "light";

  return (
    <View
      className="h-px ml-[60px]"
      style={{ backgroundColor: Colors[theme].cardBorderColor }}
    />
  );
}
