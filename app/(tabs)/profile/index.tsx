import { Button } from "@/components/Button";
import Card from "@/components/Card";
import StreakDisplay from "@/components/display/StreakDisplay";
import UserLabelList from "@/components/lists/UserLabelList";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Colors } from "@/constants/Colors";
import { useAuth } from "@/context/AuthContext";
import { getHapticsEnabled, saveHapticsEnabled } from "@/lib/offlineStorage";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import * as Updates from "expo-updates";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  Switch,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";

export default function Profile() {
  const [refreshing, setRefreshing] = useState(false);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const theme = useColorScheme() ?? "light";
  const { signOut, user } = useAuth();

  useEffect(() => {
    getHapticsEnabled().then(setHapticsEnabled);
  }, []);

  const handleHapticsToggle = async (value: boolean) => {
    setHapticsEnabled(value);
    await saveHapticsEnabled(value);

    await Updates.reloadAsync();
  };

  const handleSignout = async () => {
    try {
      // Sign out from Firebase and Google
      await signOut();

      // Clear local storage
      await AsyncStorage.clear();

      // Attempt to fully reload the app after sign-out
      if (Updates.reloadAsync) {
        await Updates.reloadAsync();
      } else {
        // Fallback: navigate to the signin screen
        router.replace("/signin");
      }
    } catch (error) {
      console.error("Sign out error:", error);
      Alert.alert("Error", "Failed to sign out. Please try again.");
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  };
  return (
    <>
      <ScrollView
        className="px-4 py-6"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors[theme].highlight]} // Android
            tintColor={Colors[theme].highlight} // iOS
          />
        }
      >
        {/* Profile Picture positioned to overlap card top border */}
        <View className="items-center mb-4" style={{ marginTop: 24 }}>
          <ThemedView style={{ position: "absolute", top: -24, zIndex: 10 }}>
            {user?.photoURL ? (
              <ThemedView>
                <Image
                  source={{ uri: user.photoURL }}
                  className="w-24 h-24 rounded-full"
                  style={{
                    borderWidth: 3,
                    borderColor: Colors[theme].highlight,
                    backgroundColor: Colors[theme].transparent,
                  }}
                />
              </ThemedView>
            ) : (
              <View
                className="w-24 h-24 rounded-full items-center justify-center"
                style={{
                  backgroundColor: Colors[theme].highlight + "20",
                  borderWidth: 3,
                  borderColor: Colors[theme].highlight,
                }}
              >
                <MaterialIcons
                  name="person"
                  size={48}
                  color={Colors[theme].highlight}
                />
              </View>
            )}
          </ThemedView>
        </View>

        <Card className="mb-4">
          <TouchableOpacity
            onPress={() => router.push("/settings")}
            style={{ position: "absolute", top: 12, right: 12, zIndex: 20 }}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            <MaterialIcons
              name="settings"
              size={22}
              color={Colors[theme].icon}
            />
          </TouchableOpacity>
          <View className="items-center py-4" style={{ paddingTop: 60 }}>
            <ThemedText
              type="defaultSemiBold"
              className="text-lg mb-1 text-center"
            >
              {user?.displayName || "User"}
            </ThemedText>
            {user?.email && (
              <ThemedText className="text-sm mb-4 text-center opacity-70">
                {user.email}
              </ThemedText>
            )}
          </View>
        </Card>

        <StreakDisplay />

        {/* <WeightDisplay /> */}

        <UserLabelList labelOnPress={() => {}} />

        <View>
          <Card className="flex-row justify-between">
            <ThemedText type="defaultSemiBold">Use Haptics</ThemedText>
            <Switch
              value={hapticsEnabled}
              onValueChange={handleHapticsToggle}
              trackColor={{
                false: Colors[theme].background,
                true: Colors[theme].highlight,
              }}
              thumbColor={Colors[theme].background}
              ios_backgroundColor={Colors[theme].background}
            />
          </Card>
        </View>

        <View className="mb-8">
          {/* <ThemedText
            type="subtitle"
            className="mb-4"
            darkColor={Colors[theme].danger}
            lightColor={Colors[theme].danger}
          >
            Danger Zone
          </ThemedText> */}
          <View className="w-full mb-8">
            <Button type="danger" onPress={handleSignout}>
              Sign Out
            </Button>
          </View>
          <View className="w-full">
            <Card>
              <TouchableOpacity
                className="flex-row justify-between"
                onPress={() => router.push("/deleteAccount")}
              >
                <ThemedText
                  type="defaultSemiBold"
                  darkColor={Colors[theme].danger}
                  lightColor={Colors[theme].danger}
                >
                  Delete Account
                </ThemedText>
                <MaterialIcons
                  name="chevron-right"
                  size={24}
                  color={Colors[theme].danger}
                />
              </TouchableOpacity>
            </Card>
          </View>
        </View>
      </ScrollView>
    </>
  );
}
