import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme.web";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type Props = {
  items: string[];
  value: string;
  onChange: (value: string) => void;
  itemWidth?: number;
};

const HorizontalWheelPicker: React.FC<Props> = ({
  items,
  value,
  onChange,
  itemWidth = 60,
}) => {
  const theme = useColorScheme() ?? "light";
  const flatRef = useRef<FlatList<any>>(null);
  // Measure actual container width instead of using window width so the
  // selected item can be centered inside the card/container the picker lives in.
  const [containerWidth, setContainerWidth] = useState<number>(
    Dimensions.get("window").width
  );
  const sidePadding = Math.max(0, (containerWidth - itemWidth) / 2);

  // Use only the real items; padding is handled by contentContainerStyle
  const data = useMemo(() => items, [items]);
  // Derive selection from value for a fully-controlled component
  const selectedIndex = useMemo(() => items.indexOf(value), [items, value]);
  const safeSelectedIndex = selectedIndex >= 0 ? selectedIndex : 0;

  useEffect(() => {
    // Wait for layout (containerWidth) to be measured so the padding is correct
    requestAnimationFrame(() => {
      try {
        flatRef.current?.scrollToOffset({
          offset: safeSelectedIndex * itemWidth,
          animated: false,
        });
      } catch {}
    });
  }, [safeSelectedIndex, itemWidth, containerWidth]);

  // Make sure we scroll to the selected value when it changes (like when cloning a set)
  useEffect(() => {
    if (value && items.includes(value)) {
      const index = items.indexOf(value);
      requestAnimationFrame(() => {
        try {
          flatRef.current?.scrollToOffset({
            offset: index * itemWidth,
            animated: true,
          });
        } catch {}
      });
    }
  }, [value, items, itemWidth]);

  return (
    <View
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width || containerWidth;
        if (w && w !== containerWidth) setContainerWidth(w);
      }}
      style={{ position: "relative" }}
      className="bg-gray-200 dark:bg-gray-900 rounded-lg"
    >
      {/* Left fade gradient */}
      <LinearGradient
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 80,
          zIndex: 1,
        }}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        colors={[
          Colors[theme].background,
          `${Colors[theme].background}00`, // Using alpha channel for proper fade
        ]}
        pointerEvents="none"
      />
      {/* Right fade gradient */}
      <LinearGradient
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: 80,
          zIndex: 1,
        }}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 0 }}
        colors={[
          Colors[theme].background,
          `${Colors[theme].background}00`, // Using alpha channel for proper fade
        ]}
        pointerEvents="none"
      />
      <FlatList
        ref={flatRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={itemWidth}
        snapToAlignment="center"
        decelerationRate="fast"
        // Ensure items re-render when selection/value/items change
        extraData={{ value, items }}
        snapToOffsets={data.map((_, i) => i * itemWidth)}
        style={{
          paddingLeft: sidePadding,
        }}
        contentContainerStyle={{
          alignItems: "center",
          paddingRight: sidePadding, // Add right padding to allow scrolling to last items
        }}
        data={data}
        ListEmptyComponent={() => (
          <View style={{ width: itemWidth, alignItems: "center" }}>
            <Text style={{ color: Colors[theme].mutedText }}>No items</Text>
          </View>
        )}
        keyExtractor={(item, idx) => `${item}-${idx}`}
        getItemLayout={(_data, index) => ({
          length: itemWidth,
          offset: itemWidth * index,
          index,
        })}
        onMomentumScrollEnd={(ev) => {
          const offsetX = ev.nativeEvent.contentOffset.x;
          const rawIndex = Math.round(offsetX / itemWidth);
          const selected = Math.min(Math.max(0, rawIndex), items.length - 1);
          if (items[selected] !== value) {
            onChange(items[selected]);
          }
          requestAnimationFrame(() => {
            try {
              flatRef.current?.scrollToOffset({
                offset: selected * itemWidth,
                animated: true,
              });
            } catch {}
          });
        }}
        renderItem={({ item }) => {
          const isSelected = String(item) === String(value);
          return (
            <TouchableOpacity
              activeOpacity={0.8}
              //TODO: re-enable onPress and make it better. it should scroll to the selected option
              /* onPress={() => {
                onChange(String(item));
                // Ensure proper centering by applying the same offset calculation as in onMomentumScrollEnd
                requestAnimationFrame(() => {
                  try {
                    flatRef.current?.scrollToOffset({
                      offset: itemIndex * itemWidth,
                      animated: true,
                    });
                  } catch {}
                });
              }} */
            >
              <View
                style={{
                  width: itemWidth,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingVertical: 12,
                }}
              >
                <Text
                  style={{
                    fontSize: isSelected ? 18 : 14,
                    fontWeight: isSelected ? "700" : "500",
                    color: isSelected
                      ? Colors[theme].text
                      : Colors[theme].mutedText,
                  }}
                >
                  {String(item)}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
};

export default HorizontalWheelPicker;
