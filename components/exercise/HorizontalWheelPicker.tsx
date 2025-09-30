import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme.web";
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

  const [selectedIndex, setSelectedIndex] = useState<number>(() =>
    Math.max(0, items.indexOf(value))
  );

  useEffect(() => {
    const idx = items.indexOf(value);
    if (idx >= 0) {
      setSelectedIndex(idx);
      // Wait for layout (containerWidth) to be measured so the padding is correct
      requestAnimationFrame(() => {
        try {
          flatRef.current?.scrollToOffset({
            offset: idx * itemWidth,
            animated: false,
          });
        } catch {}
      });
    }
  }, [value, items, itemWidth, containerWidth]);

  return (
    <View
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width || containerWidth;
        if (w && w !== containerWidth) setContainerWidth(w);
      }}
    >
      <FlatList
        ref={flatRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={itemWidth}
        snapToAlignment="center"
        decelerationRate="fast"
        snapToOffsets={data.map((_, i) => i * itemWidth)}
        style={{
          paddingLeft: sidePadding,
        }}
        contentContainerStyle={{
          alignItems: "center",
          paddingRight: sidePadding, // Add right padding to allow scrolling to last items
        }}
        data={data}
        keyExtractor={(_, idx) => String(idx)}
        getItemLayout={(_data, index) => ({
          length: itemWidth,
          offset: itemWidth * index,
          index,
        })}
        onMomentumScrollEnd={(ev) => {
          const offsetX = ev.nativeEvent.contentOffset.x;
          const rawIndex = Math.round(offsetX / itemWidth);
          const selected = Math.min(Math.max(0, rawIndex), items.length - 1);
          if (selected !== selectedIndex) {
            setSelectedIndex(selected);
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
        renderItem={({ item, index }) => {
          const itemIndex = index;
          const isSelected = itemIndex === selectedIndex;
          return (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                const to = itemIndex * itemWidth;
                flatRef.current?.scrollToOffset({
                  offset: to,
                  animated: true,
                });
                setSelectedIndex(itemIndex);
                onChange(String(item));
              }}
            >
              <View
                style={{
                  width: itemWidth,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingVertical: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: isSelected ? 18 : 14,
                    fontWeight: isSelected ? "700" : "500",
                    color: isSelected
                      ? Colors[theme].highlight
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
