import { Colors } from "@/constants/Colors";
import MaskedView from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient";
import React, { ReactNode, useState } from "react";
import {
  Pressable,
  Text,
  useColorScheme,
  View,
  type LayoutChangeEvent,
  type PressableProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";

// Wide off-screen canvas so the measuring text never wraps or truncates,
// letting us read its true single-line width.
const OFFSCREEN_MEASURE_WIDTH = 9999;

export type TintedButtonProps = Omit<PressableProps, "children"> & {
  textStyle?: TextStyle;
  children: ReactNode;
  fixedWidth?: boolean;
};

export function TintedButton({
  style,
  textStyle,
  children,
  disabled = false,
  fixedWidth = false,
  ...rest
}: TintedButtonProps) {
  const theme = useColorScheme() ?? "light";
  const [containerWidth, setContainerWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);
  const isOverflowing = containerWidth > 0 && textWidth > containerWidth;

  return (
    <Pressable
      className={`justify-center rounded-2xl border px-3.5 py-2 active:opacity-70 items-center ${
        fixedWidth ? "overflow-hidden w-48" : ""
      } ${disabled ? "opacity-50" : ""}`}
      style={[
        {
          backgroundColor: `${Colors[theme].highlight}18`,
          borderColor: `${Colors[theme].highlight}30`,
        },
        style as ViewStyle,
      ]}
      disabled={disabled}
      {...rest}
    >
      {fixedWidth ? (
        <View
          className="w-full"
          onLayout={(e: LayoutChangeEvent) =>
            setContainerWidth(e.nativeEvent.layout.width)
          }
        >
          {/* Invisible copy laid out on a wide canvas to measure the
              label's natural width without wrapping or truncation. */}
          <View
            className="absolute opacity-0"
            style={{ width: OFFSCREEN_MEASURE_WIDTH }}
            pointerEvents="none"
          >
            <Text
              className="self-start text-sm font-semibold"
              style={textStyle}
              onLayout={(e: LayoutChangeEvent) =>
                setTextWidth(e.nativeEvent.layout.width)
              }
            >
              {children}
            </Text>
          </View>

          {isOverflowing ? (
            <MaskedView
              style={{ width: "100%" }}
              maskElement={
                <LinearGradient
                  colors={["black", "black", "transparent"]}
                  locations={[0, 0.8, 1]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ flex: 1 }}
                />
              }
            >
              <Text
                className="text-sm font-semibold"
                numberOfLines={1}
                style={[
                  { color: Colors[theme].highlight, width: "100%" },
                  textStyle,
                ]}
              >
                {children}
              </Text>
            </MaskedView>
          ) : (
            <Text
              className="text-sm font-semibold text-center"
              numberOfLines={1}
              style={[
                { color: Colors[theme].highlight, width: "100%" },
                textStyle,
              ]}
            >
              {children}
            </Text>
          )}
        </View>
      ) : (
        <Text
          className="text-sm font-semibold"
          style={[{ color: Colors[theme].highlight }, textStyle]}
        >
          {children}
        </Text>
      )}
    </Pressable>
  );
}
