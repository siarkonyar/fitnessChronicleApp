import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetModalProvider,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
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
import { IconBox } from "@/components/ui/IconBox";
import { RowDivider } from "@/components/ui/RowDivider";
import { SectionCard } from "@/components/ui/SectionCard";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  Switch,
  TextInput,
  TouchableOpacity,
  View,
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

  const handleCancelName = () => {
    if (profile?.name) setName(profile.name);
    setIsEditingName(false);
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

  const handleCancelBirthday = () => {
    if (profile?.birthday) {
      const [y, m, d] = profile.birthday.split("-");
      setBirthDay(d);
      setBirthMonth(m);
      setBirthYear(y);
    }
    setBirthdayError(null);
    setIsEditingBirthday(false);
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
          <ScrollView
            className="px-4"
            contentContainerStyle={{ paddingBottom: 48, paddingTop: 8 }}
            keyboardShouldPersistTaps="handled"
          >

            {/* ── Profile ── */}
            <ThemedText type="label" className="mb-3 ml-2 mt-4">
              Profile
            </ThemedText>

            <SectionCard>
              {/* Name row */}
              <View className="flex-row items-center px-4 py-3.5">
                <IconBox name="person" color={Colors[theme].accentBlue} />
                {isEditingName ? (
                  <>
                    <ThemedTextInput
                      value={name}
                      onChangeText={setName}
                      placeholder="Your name"
                      placeholderTextColor={Colors[theme].mutedText}
                      className="flex-1 text-base ml-3"
                      maxLength={100}
                      returnKeyType="done"
                      onSubmitEditing={handleSaveName}
                      autoFocus
                    />
                    {nameMutation.isPending ? (
                      <ActivityIndicator
                        color={Colors[theme].accentBlue}
                        className="ml-2"
                      />
                    ) : (
                      <View className="flex-row gap-1.5 ml-2">
                        <RoundedButton icon="x" type="danger" onPress={handleCancelName} />
                        <RoundedButton icon="check" type="success" onPress={handleSaveName} />
                      </View>
                    )}
                  </>
                ) : (
                  <>
                    <ThemedText className="flex-1 text-base ml-3">Name</ThemedText>
                    <ThemedText
                      className="text-base mr-1.5 max-w-[160px]"
                      lightColor={Colors.light.mutedText}
                      darkColor={Colors.dark.mutedText}
                      numberOfLines={1}
                    >
                      {name || "Not set"}
                    </ThemedText>
                    <RoundedButton icon="edit" onPress={() => setIsEditingName(true)} />
                  </>
                )}
              </View>

              <RowDivider />

              {/* Birthday row */}
              <View className="flex-row items-center px-4 py-3.5">
                <IconBox name="cake" color={Colors[theme].accentPurple} />
                {isEditingBirthday ? (
                  <>
                    <View className="flex-1 flex-row items-center ml-3">
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
                        className="w-7 text-base text-center border-b pb-0.5"
                        style={{ borderBottomColor: Colors[theme].mutedText }}
                        keyboardType="number-pad"
                        maxLength={2}
                        autoFocus
                      />
                      <ThemedText
                        className="text-base mx-1"
                        lightColor={Colors.light.mutedText}
                        darkColor={Colors.dark.mutedText}
                      >
                        /
                      </ThemedText>
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
                        className="w-7 text-base text-center border-b pb-0.5"
                        style={{ borderBottomColor: Colors[theme].mutedText }}
                        keyboardType="number-pad"
                        maxLength={2}
                      />
                      <ThemedText
                        className="text-base mx-1"
                        lightColor={Colors.light.mutedText}
                        darkColor={Colors.dark.mutedText}
                      >
                        /
                      </ThemedText>
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
                        className="w-12 text-base text-center border-b pb-0.5"
                        style={{ borderBottomColor: Colors[theme].mutedText }}
                        keyboardType="number-pad"
                        maxLength={4}
                      />
                    </View>
                    {birthdayMutation.isPending ? (
                      <ActivityIndicator
                        color={Colors[theme].accentBlue}
                        className="ml-2"
                      />
                    ) : (
                      <View className="flex-row gap-1.5 ml-2">
                        <RoundedButton icon="x" type="danger" onPress={handleCancelBirthday} />
                        <RoundedButton icon="check" type="success" onPress={handleSaveBirthday} />
                      </View>
                    )}
                  </>
                ) : (
                  <>
                    <ThemedText className="flex-1 text-base ml-3">Birthday</ThemedText>
                    <ThemedText
                      className="text-base mr-1.5"
                      lightColor={Colors.light.mutedText}
                      darkColor={Colors.dark.mutedText}
                    >
                      {profile?.birthday
                        ? formatDisplayBirthday(profile.birthday)
                        : "Not set"}
                    </ThemedText>
                    <RoundedButton
                      icon="edit"
                      onPress={() => setIsEditingBirthday(true)}
                    />
                  </>
                )}
              </View>
              {birthdayError && (
                <View className="px-4 pb-3">
                  <ThemedText
                    className="text-sm"
                    lightColor={Colors.light.danger}
                    darkColor={Colors.dark.danger}
                  >
                    {birthdayError}
                  </ThemedText>
                </View>
              )}

              <RowDivider />

              {/* Gender row */}
              <TouchableOpacity
                className="flex-row items-center px-4 py-3.5"
                onPress={() => genderSheetRef.current?.present()}
                activeOpacity={0.7}
              >
                <IconBox name="people" color={Colors[theme].accentTeal} />
                <ThemedText className="flex-1 text-base ml-3">Gender</ThemedText>
                <ThemedText
                  className="text-base mr-1"
                  lightColor={Colors.light.mutedText}
                  darkColor={Colors.dark.mutedText}
                >
                  {profile?.gender ? genderLabel(profile.gender) : "Not set"}
                </ThemedText>
                <MaterialIcons
                  name="chevron-right"
                  size={22}
                  color={Colors[theme].mutedText}
                />
              </TouchableOpacity>
            </SectionCard>

            {/* ── Preferences ── */}
            <ThemedText type="label" className="mb-3 ml-2 mt-6">
              Preferences
            </ThemedText>

            <SectionCard>
              <View className="flex-row items-center px-4 py-3.5">
                <IconBox name="vibration" color={Colors[theme].highlight} />
                <ThemedText className="flex-1 text-base ml-3">Haptics</ThemedText>
                <Switch
                  value={hapticsEnabled}
                  onValueChange={handleHapticsToggle}
                  trackColor={{
                    false: Colors[theme].inputBackground,
                    true: Colors[theme].highlight,
                  }}
                  thumbColor={Colors[theme].background}
                  ios_backgroundColor={Colors[theme].inputBackground}
                />
              </View>
            </SectionCard>

            {/* ── Account ── */}
            <ThemedText type="label" className="mb-3 ml-2 mt-6">
              Account
            </ThemedText>

            <SectionCard>
              <TouchableOpacity
                className="flex-row items-center px-4 py-3.5"
                onPress={() => router.push("/deleteAccount")}
                activeOpacity={0.7}
              >
                <IconBox name="delete-forever" color={Colors[theme].danger} />
                <ThemedText
                  className="flex-1 text-base ml-3"
                  lightColor={Colors.light.danger}
                  darkColor={Colors.dark.danger}
                >
                  Delete Account
                </ThemedText>
                <MaterialIcons
                  name="chevron-right"
                  size={22}
                  color={Colors[theme].danger}
                />
              </TouchableOpacity>
            </SectionCard>

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
                className="flex-row items-center justify-between px-6 py-4 border-b"
                style={{ borderBottomColor: Colors[theme].cardBorderColor }}
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
