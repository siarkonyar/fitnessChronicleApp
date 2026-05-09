import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { View } from "react-native";

type IconBoxProps = {
  name: keyof typeof MaterialIcons.glyphMap;
  color: string;
  size?: number;
};

export function IconBox({ name, color, size = 20 }: IconBoxProps) {
  return (
    <View
      className="w-9 h-9 rounded-[10px] items-center justify-center"
      style={{ backgroundColor: `${color}22` }}
    >
      <MaterialIcons name={name} size={size} color={color} />
    </View>
  );
}
