import {
  SHEET_MAX_HEIGHT_RATIO,
  sheetHandleIndicatorStyle,
  sheetShadowStyle,
  sheetSurfaceStyle,
} from "@/constants/BottomSheetTheme";
import { InsideBottomSheetProvider } from "@/context/InsideBottomSheetContext";
import { useColorScheme } from "@/hooks/useColorScheme";
import {
  BottomSheetModal,
  type BottomSheetModalProps,
} from "@gorhom/bottom-sheet";
import React, { forwardRef } from "react";
import { useWindowDimensions } from "react-native";
import BottomSheetBlurBackdrop from "./ui/BottomSheetBlurBackdrop";

/**
 * Empty snap points put the sheet in dynamic-sizing mode, where it grows to fit
 * its content up to `maxDynamicContentSize`. Shared at module scope so the
 * array identity stays stable across renders.
 */
const DYNAMIC_SNAP_POINTS: (string | number)[] = [];

export type ThemedBottomSheetModalProps = Omit<
  BottomSheetModalProps,
  "children"
> & {
  children?: React.ReactNode;
};

/**
 * The app's bottom sheet. Wraps `BottomSheetModal` with the shared surface
 * treatment — its own elevated background, rounded and bordered top edge, an
 * upward shadow and a blurred backdrop — so a presented sheet reads as a panel
 * above the page rather than as a lighter patch of it.
 *
 * Also supplies the dynamic-sizing defaults every sheet in the app was passing
 * by hand, and provides `InsideBottomSheetContext` so form primitives nested
 * anywhere inside switch to their bottom-sheet variants.
 *
 * Every default here is overridable: caller styles merge over the shared ones,
 * and caller props win outright.
 */
const ThemedBottomSheetModal = forwardRef<
  BottomSheetModal,
  ThemedBottomSheetModalProps
>(function ThemedBottomSheetModal(
  {
    children,
    index = 0,
    snapPoints = DYNAMIC_SNAP_POINTS,
    maxDynamicContentSize,
    backgroundStyle,
    handleIndicatorStyle,
    style,
    ...rest
  },
  ref,
) {
  const theme = useColorScheme() ?? "light";
  const { height } = useWindowDimensions();

  return (
    <BottomSheetModal
      ref={ref}
      index={index}
      snapPoints={snapPoints}
      maxDynamicContentSize={
        maxDynamicContentSize ?? height * SHEET_MAX_HEIGHT_RATIO
      }
      backdropComponent={BottomSheetBlurBackdrop}
      backgroundStyle={[sheetSurfaceStyle(theme), backgroundStyle]}
      handleIndicatorStyle={[
        sheetHandleIndicatorStyle(theme),
        handleIndicatorStyle,
      ]}
      // Shadow values have no Tailwind equivalent in NativeWind and must be
      // supplied as a style object.
      style={[sheetShadowStyle(theme), style]}
      {...rest}
    >
      <InsideBottomSheetProvider>{children}</InsideBottomSheetProvider>
    </BottomSheetModal>
  );
});

export default ThemedBottomSheetModal;
