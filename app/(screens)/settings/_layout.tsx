import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { Slot, useNavigation } from "expo-router";
import React from "react";
import { View } from "react-native";

export default function SettingsLayout() {
  const theme = useColorScheme() ?? "light";
  const navigation = useNavigation();

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: "Settings",
      headerBackTitle: "Back",
      headerTintColor: Colors[theme].background,
      headerBackground: () => (
        <View style={{ flex: 1, backgroundColor: Colors[theme].highlight }} />
      ),
    });
  }, [theme, navigation]);

  return <Slot />;
}
