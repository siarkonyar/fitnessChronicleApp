import { Tabs } from "expo-router";
import React from "react";

import { HapticTab } from "@/components/HapticTab";
import MyIcon from "@/components/LogoIcon";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import Ionicons from "@expo/vector-icons/Ionicons";

export default function TabLayout() {
  const colorScheme = useColorScheme() ?? "light";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme].tint,
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: Colors[colorScheme].tabBackGround,
          borderTopColor: Colors[colorScheme].cardBorderColor,
          borderTopWidth: 1,
          height: 74,
          paddingTop: 10,
          paddingBottom: 12,
          shadowColor: Colors[colorScheme].background,
          shadowOpacity: 0.16,
          shadowRadius: 18,
          shadowOffset: {
            width: 0,
            height: -6,
          },
          elevation: 18,
        },
        tabBarShowLabel: false,
        tabBarItemStyle: {
          marginTop: 4,
        },
        tabBarButton: (props) => <HapticTab {...props} />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "",
          tabBarIcon: ({ color }) => <MyIcon size={38} color={color} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: "",
          tabBarIcon: ({ color }) => (
            <Ionicons size={28} name="calendar-outline" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "",
          tabBarIcon: ({ color }) => (
            <Ionicons size={28} name="person-outline" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
