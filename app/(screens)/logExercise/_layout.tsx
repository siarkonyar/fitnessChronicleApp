import { Stack, useNavigation } from "expo-router";
import React from "react";

export default function LogExerciseLayout() {
  const navigation = useNavigation();
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: "Log Exercise", // Sayfa başlığı (back yanındaki)
      headerBackTitle: "Back", // Geri butonu yazısı
    });
  }, [navigation]);
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
