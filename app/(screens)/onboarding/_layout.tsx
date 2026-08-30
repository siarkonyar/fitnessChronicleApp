import { Slot, useNavigation } from "expo-router";
import React from "react";

export default function OnboardingLayout() {
  const navigation = useNavigation();

  // No header and no swipe-back: onboarding is a destination the user finishes
  // or explicitly skips, not something they can reverse out of into a
  // half-configured app.
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
      gestureEnabled: false,
    });
  }, [navigation]);

  return <Slot />;
}
