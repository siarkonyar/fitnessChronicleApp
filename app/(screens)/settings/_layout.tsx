import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { Slot, useNavigation } from "expo-router";
import React from "react";

export default function SettingsLayout() {
  const theme = useColorScheme() ?? "light";
  const navigation = useNavigation();

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: "Settings",
      headerBackTitle: "Back",
      headerTransparent: false,
      headerStyle: { backgroundColor: Colors[theme].highlight },
      headerTintColor: Colors[theme].background,
    });
  }, [theme, navigation]);

  return <Slot />;
}
