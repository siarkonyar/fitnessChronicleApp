import { Colors } from "@/constants/Colors";
import type { ViewStyle } from "react-native";

export type ColorSchemeName = keyof typeof Colors;

/** Fraction of the screen a sheet may grow to before its content starts scrolling. */
export const SHEET_MAX_HEIGHT_RATIO = 0.85;

/**
 * Corner radius of the sheet's top edge. Noticeably larger than the library
 * default of 15, so the panel reads as its own surface rather than as an
 * extension of the page behind it.
 */
const SHEET_CORNER_RADIUS = 28;

/**
 * Blur applied to the page behind a presented sheet. High enough that text
 * underneath stops being readable, low enough that the layout behind is still
 * recognisable as the page you came from.
 */
export const SHEET_BLUR_INTENSITY = 32;

/**
 * Scrim laid under the blur. The alpha is baked into the colour rather than
 * passed as the backdrop's `opacity` prop, because that prop fades the whole
 * backdrop container — the blur included — which would cap the blur well below
 * its configured intensity.
 */
export const SHEET_SCRIM_COLOR: Record<ColorSchemeName, string> = {
  light: "rgba(17, 24, 28, 0.32)",
  dark: "rgba(0, 0, 0, 0.55)",
};

/**
 * Shadows are neutral black in both themes; `Colors` has no black token because
 * no surface in the app is ever painted with it.
 */
const SHEET_SHADOW_COLOR = "#000000";

/** The sheet casts upward, onto the dimmed page it is covering. */
const SHEET_SHADOW_OFFSET = { width: 0, height: -6 };

const SHEET_SHADOW_RADIUS = 20;

/** Android has no shadow offset; it derives the whole drop from this depth. */
const SHEET_SHADOW_ANDROID_ELEVATION = 24;

/**
 * Dark mode needs a heavier shadow: against a near-black page a faint one is
 * invisible, and the surface colour alone does not read as "floating".
 */
const SHEET_SHADOW_OPACITY: Record<ColorSchemeName, number> = {
  light: 0.18,
  dark: 0.45,
};

/**
 * The sheet's own panel. Uses the `elevation` token rather than `background`:
 * `background` is the colour of the screen *behind* the sheet, which left the
 * panel with no colour difference from the page at all.
 */
export function sheetSurfaceStyle(theme: ColorSchemeName): ViewStyle {
  const palette = Colors[theme];

  return {
    backgroundColor: palette.elevation,
    borderTopLeftRadius: SHEET_CORNER_RADIUS,
    borderTopRightRadius: SHEET_CORNER_RADIUS,
    borderTopWidth: 1,
    borderColor: palette.cardBorderColor,
  };
}

/**
 * The drag handle. `mutedText` rather than `separator`, which in dark mode is a
 * muddy rust (`#6B2A10`) that barely reads against the sheet.
 */
export function sheetHandleIndicatorStyle(theme: ColorSchemeName): ViewStyle {
  return { backgroundColor: Colors[theme].mutedText };
}

export function sheetShadowStyle(theme: ColorSchemeName): ViewStyle {
  return {
    shadowColor: SHEET_SHADOW_COLOR,
    shadowOffset: SHEET_SHADOW_OFFSET,
    shadowOpacity: SHEET_SHADOW_OPACITY[theme],
    shadowRadius: SHEET_SHADOW_RADIUS,
    elevation: SHEET_SHADOW_ANDROID_ELEVATION,
  };
}
