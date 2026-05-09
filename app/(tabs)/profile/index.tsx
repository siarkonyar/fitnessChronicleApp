import { Button } from "@/components/Button";
import Card from "@/components/Card";
import StreakDisplay from "@/components/display/StreakDisplay";
import UserLabelList from "@/components/lists/UserLabelList";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Colors } from "@/constants/Colors";
import { useAuth } from "@/context/AuthContext";
import { getUserProfile } from "@/lib/firebase/user";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import * as Updates from "expo-updates";
import React, { useState } from "react";
import {
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";

const GENDER_LABELS: Record<string, string> = {
  male: "Male",
  female: "Female",
  non_binary: "Non-binary",
  prefer_not_to_say: "Prefer not to say",
};

function genderLabel(value: string): string {
  return GENDER_LABELS[value] ?? value;
}

function calculateAge(birthday: string): number {
  const today = new Date();
  const birth = new Date(birthday);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export default function Profile() {
  const [refreshing, setRefreshing] = useState(false);
  const theme = useColorScheme() ?? "light";
  const { signOut, user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["userProfile"],
    queryFn: getUserProfile,
  });

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
              <ThemedText className="text-sm text-center opacity-70"
                style={{ marginBottom: profile?.birthday || profile?.gender ? 10 : 16 }}
              >
                {user.email}
              </ThemedText>
            )}
            {(profile?.birthday || profile?.gender) && (
              <View className="flex-row gap-2 justify-center mb-4">
                {profile.birthday && (
                  <View
                    className="px-3 py-1 rounded-full"
                    style={{ backgroundColor: Colors[theme].inputBackground }}
                  >
                    <ThemedText
                      className="text-xs"
                      lightColor={Colors.light.mutedText}
                      darkColor={Colors.dark.mutedText}
                    >
                      {calculateAge(profile.birthday)} yrs
                    </ThemedText>
                  </View>
                )}
                {profile.gender && (
                  <View
                    className="px-3 py-1 rounded-full"
                    style={{ backgroundColor: Colors[theme].inputBackground }}
                  >
                    <ThemedText
                      className="text-xs"
                      lightColor={Colors.light.mutedText}
                      darkColor={Colors.dark.mutedText}
                    >
                      {genderLabel(profile.gender)}
                    </ThemedText>
                  </View>
                )}
              </View>
            )}
          </View>
        </Card>

        <StreakDisplay />

        {/* <WeightDisplay /> */}

        <UserLabelList labelOnPress={() => {}} />

        <View className="mb-8">
          <View className="w-full mb-8">
            <Button type="danger" onPress={handleSignout}>
              Sign Out
            </Button>
          </View>
        </View>
      </ScrollView>
    </>
  );
}
