import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { BlurTargetView } from "expo-blur";
import React, { createContext, useContext, useRef, type RefObject } from "react";
import type { View } from "react-native";

const SheetBlurTargetContext = createContext<RefObject<View | null> | null>(
  null,
);

/**
 * A BottomSheetModalProvider whose screens Android can blur behind a sheet.
 *
 * Since expo-blur 55, Android blurs only the content of the BlurTargetView a
 * BlurView points at, and draws no blur at all without one. The target wraps
 * the screens but not the provider's portal host, where the sheets and their
 * backdrops render, so a backdrop never tries to blur itself. On iOS the target
 * is a plain View.
 *
 * The context sits outside BottomSheetModalProvider because @gorhom/portal
 * renders each sheet at that host, so a backdrop reads its context from there.
 */
export function SheetModalProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const blurTarget = useRef<View>(null);

  return (
    <SheetBlurTargetContext.Provider value={blurTarget}>
      <BottomSheetModalProvider>
        <BlurTargetView ref={blurTarget} style={{ flex: 1 }}>
          {children}
        </BlurTargetView>
      </BottomSheetModalProvider>
    </SheetBlurTargetContext.Provider>
  );
}

/** The blur target of the nearest SheetModalProvider, or null outside one. */
export function useSheetBlurTarget(): RefObject<View | null> | null {
  return useContext(SheetBlurTargetContext);
}
