import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { Stack, useNavigation } from "expo-router";
import React from "react";
import { View } from "react-native";

export default function AddLabelLayout() {
  const theme = useColorScheme() ?? "light";

  const navigation = useNavigation();
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: "Add Label", // Sayfa başlığı (back yanındaki)
      headerBackTitle: "Back", // Geri butonu yazısı
      headerTintColor: Colors[theme].background,
      headerBackground: () => (
        <View style={{ flex: 1, backgroundColor: Colors[theme].highlight }} />
      ),
    });
  }, [theme, navigation]);
  return (
    <Stack
      screenOptions={{
        headerTransparent: true,
        headerStyle: { backgroundColor: "transparent" },
        contentStyle: { backgroundColor: "transparent" },
        headerShown: false,
        headerLargeTitle: true,
        headerLargeStyle: { backgroundColor: "transparent" },
        headerLargeTitleShadowVisible: false,
        headerBackVisible: true,
      }}
    >
      <Stack.Screen name="index" options={{}} />
    </Stack>
  );
}
