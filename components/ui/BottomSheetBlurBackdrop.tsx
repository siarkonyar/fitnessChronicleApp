import {
  SHEET_BLUR_INTENSITY,
  SHEET_SCRIM_COLOR,
} from "@/constants/BottomSheetTheme";
import { useSheetBlurTarget } from "@/context/SheetBlurTargetContext";
import { useColorScheme } from "@/hooks/useColorScheme";
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { BlurView } from "expo-blur";
import React from "react";
import { StyleSheet } from "react-native";

/**
 * The backdrop behind every bottom sheet: the page is blurred as well as dimmed,
 * so the sheet reads as a panel floating over the app rather than as a lighter
 * region of the same surface.
 *
 * `BottomSheetBackdrop` renders its children inside an `Animated.View` whose
 * opacity is already interpolated from the sheet's position, so nesting the
 * blur inside it gives us the fade in/out — and tap-to-close — for free.
 */
export default function BottomSheetBlurBackdrop(
  props: BottomSheetBackdropProps,
) {
  const theme = useColorScheme() ?? "light";
  const blurTarget = useSheetBlurTarget();

  return (
    <BottomSheetBackdrop
      {...props}
      appearsOnIndex={0}
      disappearsOnIndex={-1}
      pressBehavior="close"
      // The container renders at full opacity and the dimming comes from the
      // scrim's own alpha. Dimming via `opacity` instead would fade the blur
      // along with it. See SHEET_SCRIM_COLOR.
      opacity={1}
      style={[props.style, { backgroundColor: SHEET_SCRIM_COLOR[theme] }]}
    >
      <BlurView
        // Android blurs only with a blur method and a target to blur, the
        // screens wrapped by SheetModalProvider; without either it renders a
        // plain translucent view. iOS ignores both.
        blurMethod="dimezisBlurView"
        blurTarget={blurTarget ?? undefined}
        intensity={SHEET_BLUR_INTENSITY}
        tint={theme}
        // Taps must fall through to the backdrop's own gesture handler.
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />
    </BottomSheetBackdrop>
  );
}
