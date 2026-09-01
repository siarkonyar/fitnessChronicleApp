import { RoundedButton } from "@/components/RoundButton";
import { ThemedText } from "@/components/ThemedText";
import { ThemedTextInput } from "@/components/ThemedTextInput";
import { ThemedView } from "@/components/ThemedView";
import { IconBox } from "@/components/ui/IconBox";
import { RowDivider } from "@/components/ui/RowDivider";
import { SectionCard } from "@/components/ui/SectionCard";
import { Colors } from "@/constants/Colors";
import { queryKeys } from "@/constants/QueryKeys";
import { useAuth } from "@/context/AuthContext";
import { logEvent } from "@/lib/analytics/client";
import { setAnalyticsConsent } from "@/lib/analytics/consent";
import {
  getUserProfile,
  getUserSettings,
  updateUserProfile,
} from "@/lib/firebase/user";
import {
  getDefaultMeasurement,
  getDefaultRepType,
  getHapticsEnabled,
  saveDefaultMeasurement,
  saveDefaultRepType,
  saveHapticsEnabled,
} from "@/lib/offlineStorage";
import {
  GENDER_OPTIONS,
  formatDisplayBirthday,
  genderLabel,
  toIsoBirthday,
  validateBirthday,
  type GenderValue,
} from "@/lib/profile";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import * as Updates from "expo-updates";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Switch,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function Settings() {
  const theme = useColorScheme() ?? "light";
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { refreshUser, signOut } = useAuth();

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
  const [defaultFixedReps, setDefaultFixedReps] = useState(false);
  const [defaultMeasurement, setDefaultMeasurement] = useState<"kg" | "lbs">(
    "kg",
  );

  useEffect(() => {
    getHapticsEnabled().then(setHapticsEnabled);
    getDefaultRepType().then(setDefaultFixedReps);
    getDefaultMeasurement().then(setDefaultMeasurement);
  }, []);

  const handleHapticsToggle = async (value: boolean) => {
    setHapticsEnabled(value);
    // Logged before the reload below, which tears the JS context down and
    // would take an unsent event with it.
    logEvent("settings_changed", { setting: "haptics", value: String(value) });
    await saveHapticsEnabled(value);
    await Updates.reloadAsync();
  };

  const handleDefaultRepTypeToggle = async (value: boolean) => {
    setDefaultFixedReps(value);
    logEvent("settings_changed", {
      setting: "fixed_reps",
      value: String(value),
    });
    await saveDefaultRepType(value);
  };

  const handleDefaultMeasurementChange = async (value: "kg" | "lbs") => {
    setDefaultMeasurement(value);
    logEvent("settings_changed", { setting: "measurement", value });
    await saveDefaultMeasurement(value);
  };

  // Firestore-backed, unlike the three preferences above — the choice has to
  // follow the user to their other devices, and the server needs to see it
  // change so it can write the consent record.
  const { data: userSettings } = useQuery({
    queryKey: queryKeys.userSettings.all,
    queryFn: getUserSettings,
  });

  // Nothing stored means never asked, and never asked is not permission. Must
  // match DEFAULT_CONSENT in lib/analytics/consent.ts — if the two disagree,
  // this row shows a switch that contradicts what the SDK is actually doing.
  const analyticsEnabled = userSettings?.analyticsConsent ?? false;

  const handleAnalyticsToggle = (value: boolean) => {
    // Sent before collection is switched off, so an opt-out is the last thing
    // recorded rather than the one change that never gets reported.
    logEvent("settings_changed", {
      setting: "analytics_consent",
      value: String(value),
    });

    setAnalyticsConsent(value);

    // Moves the switch now. setAnalyticsConsent deliberately does not wait for
    // the server, so without this the row would snap back to the old value
    // until the query happened to refetch.
    queryClient.setQueryData(
      queryKeys.userSettings.all,
      (previous: typeof userSettings) =>
        previous ? { ...previous, analyticsConsent: value } : previous,
    );
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
    birthdayMutation.mutate({
      birthday: toIsoBirthday(birthDay, birthMonth, birthYear),
    });
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

  const handleSignout = async () => {
    try {
      await signOut();
      queryClient.clear();
      await AsyncStorage.clear();
      if (Updates.reloadAsync) {
        await Updates.reloadAsync();
      } else {
        router.replace("/signin");
      }
    } catch (error) {
      console.error("Sign out error:", error);
      Alert.alert("Error", "Failed to sign out. Please try again.");
    }
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
    <>
      <ThemedView className="flex-1">
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
            <View className="flex-row items-center px-4 py-4">
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
                      <RoundedButton
                        icon="x"
                        type="danger"
                        onPress={handleCancelName}
                      />
                      <RoundedButton
                        icon="check"
                        type="success"
                        onPress={handleSaveName}
                      />
                    </View>
                  )}
                </>
              ) : (
                <>
                  <ThemedText className="flex-1 text-base ml-3">
                    Name
                  </ThemedText>
                  <ThemedText
                    className="text-base mr-1.5 max-w-[160px]"
                    lightColor={Colors.light.mutedText}
                    darkColor={Colors.dark.mutedText}
                    numberOfLines={1}
                  >
                    {name || "Not set"}
                  </ThemedText>
                  <RoundedButton
                    icon="edit"
                    type="blue"
                    onPress={() => setIsEditingName(true)}
                  />
                </>
              )}
            </View>

            <RowDivider />

            {/* Birthday row */}
            <View className="flex-row items-center px-4 py-4">
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
                      <RoundedButton
                        icon="x"
                        type="danger"
                        onPress={handleCancelBirthday}
                      />
                      <RoundedButton
                        icon="check"
                        type="success"
                        onPress={handleSaveBirthday}
                      />
                    </View>
                  )}
                </>
              ) : (
                <>
                  <ThemedText className="flex-1 text-base ml-3">
                    Birthday
                  </ThemedText>
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
                    type="blue"
                    onPress={() => setIsEditingBirthday(true)}
                  />
                </>
              )}
            </View>
            {birthdayError && (
              <View className="px-4 pb-3">
                <ThemedText
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
              className="flex-row items-center px-4 py-4"
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
            <View className="flex-row items-center px-4 py-4">
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

            <RowDivider />

            <View className="flex-row px-4 py-4">
              <View className="justify-center">
                <IconBox
                  name="fitness-center"
                  color={Colors[theme].accentBlue}
                />
              </View>
              <View className="flex-1 ml-3">
                <ThemedText className="text-base">Fixed Reps</ThemedText>
                <ThemedText
                  lightColor={Colors.light.mutedText}
                  darkColor={Colors.dark.mutedText}
                >
                  {defaultFixedReps
                    ? "Enter exact rep count"
                    : "Pick from rep range"}
                </ThemedText>
              </View>
              <View className="justify-center">
                <Switch
                  value={defaultFixedReps}
                  onValueChange={handleDefaultRepTypeToggle}
                  trackColor={{
                    false: Colors[theme].inputBackground,
                    true: Colors[theme].highlight,
                  }}
                  thumbColor={Colors[theme].background}
                  ios_backgroundColor={Colors[theme].inputBackground}
                />
              </View>
            </View>

            <RowDivider />

            <TouchableOpacity
              className="flex-row px-4 py-4"
              onPress={() =>
                handleDefaultMeasurementChange(
                  defaultMeasurement === "kg" ? "lbs" : "kg",
                )
              }
              activeOpacity={0.7}
            >
              <View className="justify-center">
                <IconBox
                  name="monitor-weight"
                  color={Colors[theme].accentTeal}
                />
              </View>
              <View className="flex-1 ml-3">
                <ThemedText className="text-base">
                  Default Measurement
                </ThemedText>
                <ThemedText
                  lightColor={Colors.light.mutedText}
                  darkColor={Colors.dark.mutedText}
                >
                  Tap to change
                </ThemedText>
              </View>
              <View className="justify-center">
                <View
                  style={{
                    backgroundColor: Colors[theme].highlight + "22",
                    paddingHorizontal: 10,
                    paddingVertical: 3,
                    borderRadius: 6,
                  }}
                >
                  <ThemedText
                    style={{
                      color: Colors[theme].highlight,
                      fontSize: 13,
                      fontWeight: "600",
                    }}
                  >
                    {defaultMeasurement === "kg" ? "Kg" : "Lbs"}
                  </ThemedText>
                </View>
              </View>
            </TouchableOpacity>

            <RowDivider />

            <View className="flex-row px-4 py-4">
              <View className="justify-center">
                <IconBox name="insights" color={Colors[theme].secondary} />
              </View>
              <View className="flex-1 ml-3">
                <ThemedText className="text-base">Share Usage Data</ThemedText>
                <ThemedText
                  lightColor={Colors.light.mutedText}
                  darkColor={Colors.dark.mutedText}
                >
                  Anonymous stats that help improve Hercule. Never your
                  workouts, weights, or messages.
                </ThemedText>
              </View>
              <View className="justify-center">
                <Switch
                  value={analyticsEnabled}
                  onValueChange={handleAnalyticsToggle}
                  trackColor={{
                    false: Colors[theme].inputBackground,
                    true: Colors[theme].highlight,
                  }}
                  thumbColor={Colors[theme].background}
                  ios_backgroundColor={Colors[theme].inputBackground}
                />
              </View>
            </View>
          </SectionCard>

          {/* ── Account ── */}
          <ThemedText type="label" className="mb-3 ml-2 mt-6">
            Account
          </ThemedText>

          <SectionCard>
            <TouchableOpacity
              className="flex-row items-center px-4 py-4"
              onPress={handleSignout}
              activeOpacity={0.7}
            >
              <IconBox name="logout" color={Colors[theme].danger} />
              <ThemedText
                className="flex-1 text-base ml-3"
                lightColor={Colors.light.danger}
                darkColor={Colors.dark.danger}
              >
                Sign Out
              </ThemedText>
            </TouchableOpacity>

            <RowDivider />

            <TouchableOpacity
              className="flex-row items-center px-4 py-4"
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
          <ThemedText type="defaultSemiBold" className="text-center mb-4 mt-2">
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
    </>
  );
}
