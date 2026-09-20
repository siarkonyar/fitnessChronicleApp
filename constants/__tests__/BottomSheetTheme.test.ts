import { Colors } from "../Colors";
import {
  SHEET_SCRIM_COLOR,
  sheetHandleIndicatorStyle,
  sheetShadowStyle,
  sheetSurfaceStyle,
  type ColorSchemeName,
} from "../BottomSheetTheme";

const THEMES: ColorSchemeName[] = ["light", "dark"];

describe("sheetSurfaceStyle", () => {
  test.each(THEMES)(
    "gives the sheet a colour distinct from the page behind it in %s mode",
    (theme) => {
      // Arrange — `background` is what the screen behind the sheet is painted with.
      const pageBackground = Colors[theme].background;

      // Act
      const surface = sheetSurfaceStyle(theme);

      // Assert — the whole point of the treatment: the panel is not the page.
      expect(surface.backgroundColor).not.toBe(pageBackground);
      expect(surface.backgroundColor).toBe(Colors[theme].elevation);
    },
  );

  test.each(THEMES)("rounds only the top corners in %s mode", (theme) => {
    const surface = sheetSurfaceStyle(theme);

    expect(surface.borderTopLeftRadius).toBe(surface.borderTopRightRadius);
    expect(surface.borderTopLeftRadius).toBeGreaterThan(15);
    expect(surface.borderBottomLeftRadius).toBeUndefined();
  });

  test.each(THEMES)("draws a hairline top border in %s mode", (theme) => {
    const surface = sheetSurfaceStyle(theme);

    expect(surface.borderTopWidth).toBe(1);
    expect(surface.borderColor).toBe(Colors[theme].cardBorderColor);
  });
});

describe("sheetHandleIndicatorStyle", () => {
  test.each(THEMES)(
    "uses mutedText rather than the low-contrast separator in %s mode",
    (theme) => {
      const handle = sheetHandleIndicatorStyle(theme);

      expect(handle.backgroundColor).toBe(Colors[theme].mutedText);
      expect(handle.backgroundColor).not.toBe(Colors[theme].separator);
    },
  );
});

describe("sheetShadowStyle", () => {
  test.each(THEMES)("casts upward onto the page in %s mode", (theme) => {
    const shadow = sheetShadowStyle(theme);

    expect(shadow.shadowOffset?.height).toBeLessThan(0);
    expect(shadow.shadowOffset?.width).toBe(0);
  });

  test("is heavier in dark mode, where a faint shadow would be invisible", () => {
    const light = sheetShadowStyle("light");
    const dark = sheetShadowStyle("dark");

    // ViewStyle types these as AnimatableNumericValue; ours are plain numbers.
    expect(Number(dark.shadowOpacity)).toBeGreaterThan(
      Number(light.shadowOpacity),
    );
  });

  test.each(THEMES)("gives Android a shadow depth in %s mode", (theme) => {
    // Android ignores shadowOffset/Opacity/Radius and needs `elevation`.
    expect(sheetShadowStyle(theme).elevation).toBeGreaterThan(0);
  });
});

describe("SHEET_SCRIM_COLOR", () => {
  test.each(THEMES)(
    "is translucent in %s mode so the blur behind it still shows through",
    (theme) => {
      const alpha = Number(
        SHEET_SCRIM_COLOR[theme].replace(/^rgba\(.*,\s*([\d.]+)\)$/, "$1"),
      );

      expect(alpha).toBeGreaterThan(0);
      expect(alpha).toBeLessThan(1);
    },
  );
});
