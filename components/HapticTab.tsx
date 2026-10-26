import { getHapticsEnabled } from "@/lib/offlineStorage";
import { BottomTabBarButtonProps } from "expo-router/js-tabs";
import { PlatformPressable } from "expo-router/react-navigation";
import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";

export function HapticTab(props: BottomTabBarButtonProps) {
  const [hapticsEnabled, setHapticsEnabled] = useState(true);

  useEffect(() => {
    getHapticsEnabled().then(setHapticsEnabled);
  }, []);

  return (
    <PlatformPressable
      {...props}
      onPressIn={(ev) => {
        if (process.env.EXPO_OS === "ios" && hapticsEnabled) {
          // Add a soft haptic feedback when pressing down on the tabs.
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        props.onPressIn?.(ev);
      }}
    />
  );
}
