import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetModalProvider,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import MutedCard from "@/components/cards/MuteCard";
import { RoundedButton } from "@/components/RoundButton";
import { ThemedText } from "@/components/ThemedText";
import { ThemedTextInput } from "@/components/ThemedTextInput";
import { ThemedView } from "@/components/ThemedView";
import { Colors } from "@/constants/Colors";
import { useAuth } from "@/context/AuthContext";
import { getUserProfile, updateUserProfile } from "@/lib/firebase/user";
import { getHapticsEnabled, saveHapticsEnabled } from "@/lib/offlineStorage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import * as Updates from "expo-updates";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  Switch,
  TextInput,
  TouchableOpacity,
  useColorScheme,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const CURRENT_YEAR = new Date().getFullYear();

const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "non_binary", label: "Non-binary" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
] as const;

type GenderValue = (typeof GENDER_OPTIONS)[number]["value"];

function validateBirthday(day: string, month: string, year: string): string | null {
  if (!day || !month || !year) return "Please fill in all fields.";
  const d = parseInt(day, 10);
  const m = parseInt(month, 10);
  const y = parseInt(year, 10);
  if (isNaN(d) || d < 1 || d > 31) return "Day must be between 01 and 31.";
  if (isNaN(m) || m < 1 || m > 12) return "Month must be between 01 and 12.";
  if (isNaN(y) || y < 1900 || y > CURRENT_YEAR)
    return `Year must be between 1900 and ${CURRENT_YEAR}.`;
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d)
    return "Invalid date.";
  return null;
}

function formatDisplayBirthday(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day} / ${month} / ${year}`;
}

function genderLabel(value: string): string {
  return GENDER_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export default function Settings() {
  const theme = useColorScheme() ?? "light";
  const insets = useSafeAreaInsets();
  const topPadding = Platform.OS === "android" ? 64 : 2 * insets.top;
  const queryClient = useQueryClient();
  const { refreshUser } = useAuth();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["userProfile"],
    queryFn: getUserProfile,
  });

  const [name, setName] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);

  const [birthDay, setBirthDay] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [isEditingBirthday, setIsEditingBirthday] = useState(false);
  const [birthdayError, setBirthdayError] = useState<string | null>(null);

  const monthRef = useRef<TextInput>(null);
  const yearRef = useRef<TextInput>(null);

  const genderSheetRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => [], []);

  const [hapticsEnabled, setHapticsEnabled] = useState(true);

  useEffect(() => {
    getHapticsEnabled().then(setHapticsEnabled);
  }, []);

  const handleHapticsToggle = async (value: boolean) => {
    setHapticsEnabled(value);
    await saveHapticsEnabled(value);
    await Updates.reloadAsync();
  };

  useEffect(() => {
    if (profile?.name) setName(profile.name);
    if (profile?.birthday) {
      const [y, m, d] = profile.birthday.split("-");
      setBirthDay(d);
      setBirthMonth(m);
      setBirthYear(y);
    }
  }, [profile]);

  const nameMutation = useMutation({
    mutationFn: updateUserProfile,
    onSuccess: async () => {
      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ["userProfile"] });
      setIsEditingName(false);
    },
    onError: () => Alert.alert("Error", "Failed to save. Please try again."),
  });

  const birthdayMutation = useMutation({
    mutationFn: updateUserProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userProfile"] });
      setIsEditingBirthday(false);
      setBirthdayError(null);
    },
    onError: () => Alert.alert("Error", "Failed to save. Please try again."),
  });

  const genderMutation = useMutation({
    mutationFn: updateUserProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userProfile"] });
      genderSheetRef.current?.dismiss();
    },
    onError: () => Alert.alert("Error", "Failed to save. Please try again."),
  });

  const handleSaveName = () => {
    nameMutation.mutate({ name: name.trim() || undefined });
  };

  const handleSaveBirthday = () => {
    const error = validateBirthday(birthDay, birthMonth, birthYear);
    if (error) {
      setBirthdayError(error);
      return;
    }
    const isoDate = `${birthYear}-${birthMonth.padStart(2, "0")}-${birthDay.padStart(2, "0")}`;
    birthdayMutation.mutate({ birthday: isoDate });
  };

  const handleSelectGender = (value: GenderValue) => {
    genderMutation.mutate({ gender: value });
  };

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
      />
    ),
    [],
  );

  if (isLoading) {
    return (
      <ThemedView className="flex-1 items-center justify-center">
        <ActivityIndicator color={Colors[theme].highlight} />
      </ThemedView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <ThemedView className="flex-1" style={{ paddingTop: topPadding }}>
          <ScrollView className="px-4 py-6" keyboardShouldPersistTaps="handled">

            <ThemedText type="defaultSemiBold" className="mb-2 ml-1">
              Name
            </ThemedText>
            <MutedCard className="items-center justify-between mb-6">
              {isEditingName ? (
                <ThemedTextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Your name"
                  placeholderTextColor={Colors[theme].mutedText}
                  className="text-base font-medium flex-1 border-b border-gray-400 mr-2"
                  maxLength={100}
                  returnKeyType="done"
                  autoFocus
                />
              ) : (
                <ThemedText className="text-base font-medium flex-1">
                  {name || "Not set"}
                </ThemedText>
              )}
              <ThemedView className="flex-row">
                {isEditingName ? (
                  nameMutation.isPending ? (
                    <ActivityIndicator
                      color={Colors[theme].accentBlue}
                      style={{ padding: 10 }}
                    />
                  ) : (
                    <RoundedButton icon="check" onPress={handleSaveName} />
                  )
                ) : (
                  <RoundedButton icon="edit" onPress={() => setIsEditingName(true)} />
                )}
              </ThemedView>
            </MutedCard>

            <ThemedText type="defaultSemiBold" className="mb-2 ml-1">
              Birthday
            </ThemedText>
            <MutedCard className="items-center justify-between mb-1">
              {isEditingBirthday ? (
                <ThemedView className="flex-row flex-1 items-center mr-2">
                  <ThemedTextInput
                    value={birthDay}
                    onChangeText={(text) => {
                      const numeric = text.replace(/\D/g, "").slice(0, 2);
                      setBirthDay(numeric);
                      setBirthdayError(null);
                      if (numeric.length === 2) monthRef.current?.focus();
                    }}
                    placeholder="DD"
                    placeholderTextColor={Colors[theme].mutedText}
                    className="text-base font-medium border-b border-gray-400 text-center"
                    style={{ width: 28 }}
                    keyboardType="number-pad"
                    maxLength={2}
                    autoFocus
                  />
                  <ThemedText className="text-base font-medium mx-2">/</ThemedText>
                  <ThemedTextInput
                    ref={monthRef}
                    value={birthMonth}
                    onChangeText={(text) => {
                      const numeric = text.replace(/\D/g, "").slice(0, 2);
                      setBirthMonth(numeric);
                      setBirthdayError(null);
                      if (numeric.length === 2) yearRef.current?.focus();
                    }}
                    placeholder="MM"
                    placeholderTextColor={Colors[theme].mutedText}
                    className="text-base font-medium border-b border-gray-400 text-center"
                    style={{ width: 28 }}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                  <ThemedText className="text-base font-medium mx-2">/</ThemedText>
                  <ThemedTextInput
                    ref={yearRef}
                    value={birthYear}
                    onChangeText={(text) => {
                      const numeric = text.replace(/\D/g, "").slice(0, 4);
                      setBirthYear(numeric);
                      setBirthdayError(null);
                    }}
                    placeholder="YYYY"
                    placeholderTextColor={Colors[theme].mutedText}
                    className="text-base font-medium border-b border-gray-400 text-center"
                    style={{ width: 48 }}
                    keyboardType="number-pad"
                    maxLength={4}
                  />
                </ThemedView>
              ) : (
                <ThemedText className="text-base font-medium flex-1">
                  {profile?.birthday
                    ? formatDisplayBirthday(profile.birthday)
                    : "Not set"}
                </ThemedText>
              )}
              <ThemedView className="flex-row">
                {isEditingBirthday ? (
                  birthdayMutation.isPending ? (
                    <ActivityIndicator
                      color={Colors[theme].accentBlue}
                      style={{ padding: 10 }}
                    />
                  ) : (
                    <RoundedButton icon="check" onPress={handleSaveBirthday} />
                  )
                ) : (
                  <RoundedButton icon="edit" onPress={() => setIsEditingBirthday(true)} />
                )}
              </ThemedView>
            </MutedCard>
            {birthdayError && (
              <ThemedText
                className="text-sm ml-1 mb-2"
                style={{ color: Colors[theme].danger }}
              >
                {birthdayError}
              </ThemedText>
            )}

            <ThemedText type="defaultSemiBold" className="mb-2 ml-1 mt-4">
              Gender
            </ThemedText>
            <MutedCard className="items-center justify-between mb-6">
              <ThemedText className="text-base font-medium flex-1">
                {profile?.gender ? genderLabel(profile.gender) : "Not set"}
              </ThemedText>
              <RoundedButton
                icon="chevron-down"
                onPress={() => genderSheetRef.current?.present()}
              />
            </MutedCard>

            <ThemedText type="defaultSemiBold" className="mb-2 ml-1">
              Preferences
            </ThemedText>
            <MutedCard className="items-center justify-between mb-6">
              <ThemedText className="text-base font-medium flex-1">
                Haptics
              </ThemedText>
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
            </MutedCard>

            <ThemedText type="defaultSemiBold" className="mb-2 ml-1">
              Account
            </ThemedText>
            <MutedCard
              className="items-center justify-between mb-6"
              onPress={() => router.push("/deleteAccount")}
            >
              <ThemedText
                className="text-base font-medium flex-1"
                lightColor={Colors[theme].danger}
                darkColor={Colors[theme].danger}
              >
                Delete Account
              </ThemedText>
              <MaterialIcons
                name="chevron-right"
                size={24}
                color={Colors[theme].danger}
              />
            </MutedCard>

          </ScrollView>
        </ThemedView>

        <BottomSheetModal
          ref={genderSheetRef}
          index={0}
          snapPoints={snapPoints}
          backdropComponent={renderBackdrop}
          backgroundStyle={{ backgroundColor: Colors[theme].cardBackground }}
          handleIndicatorStyle={{ backgroundColor: Colors[theme].separator }}
        >
          <BottomSheetView>
            <ThemedText
              type="defaultSemiBold"
              className="text-center text-lg mb-4 mt-2"
            >
              Select Gender
            </ThemedText>
            {GENDER_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                onPress={() => handleSelectGender(option.value)}
                disabled={genderMutation.isPending}
                className="flex-row items-center justify-between px-6 py-4 border-b border-gray-200/50 dark:border-gray-600/50"
              >
                <ThemedText className="text-base">{option.label}</ThemedText>
                {genderMutation.isPending && profile?.gender === option.value && (
                  <ActivityIndicator color={Colors[theme].accentBlue} />
                )}
              </TouchableOpacity>
            ))}
            <ThemedView style={{ height: insets.bottom + 16 }} />
          </BottomSheetView>
        </BottomSheetModal>

      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}
