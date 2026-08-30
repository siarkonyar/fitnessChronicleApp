import { ThemedText } from "@/components/ThemedText";
import { ThemedTextInput } from "@/components/ThemedTextInput";
import { ThemedView } from "@/components/ThemedView";
import { Colors } from "@/constants/Colors";
import { queryKeys } from "@/constants/QueryKeys";
import { useAuth } from "@/context/AuthContext";
import { updateUserProfile, updateUserSettings } from "@/lib/firebase/user";
import { saveDefaultMeasurement } from "@/lib/offlineStorage";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  Pressable,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import Animated, { Easing, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  GENDER_OPTIONS,
  toIsoBirthday,
  validateBirthday,
  type GenderValue,
} from "../../../lib/profile";

type Measure = "kg" | "lbs";
type FocusableField = "name" | "birthday" | null;

const MEASURE_OPTIONS: readonly {
  value: Measure;
  title: string;
  caption: string;
}[] = [
  { value: "kg", title: "KG", caption: "kilograms" },
  { value: "lbs", title: "LBS", caption: "pounds" },
];

const NAME_MAX_LENGTH = 100;

// Each block enters slightly after the one above it, so the screen assembles
// itself top-down instead of appearing all at once.
const REVEAL_STEP_MS = 60;

export default function Onboarding() {
  const theme = useColorScheme() ?? "light";
  const palette = Colors[theme];
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { refreshUser } = useAuth();

  const [name, setName] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [gender, setGender] = useState<GenderValue | null>(null);
  const [measure, setMeasure] = useState<Measure>("kg");
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState<FocusableField>(null);

  const monthRef = useRef<TextInput>(null);
  const yearRef = useRef<TextInput>(null);

  const goToApp = useCallback(() => router.replace("/(tabs)"), []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const isBirthdayFilled = Boolean(birthDay && birthMonth && birthYear);

      // The measurement is deliberately written twice: AsyncStorage is what
      // the exercise logger reads for its default, while the Firestore copy is
      // what the weight modals read. Writing one leaves the other disagreeing.
      await Promise.all([
        updateUserProfile({
          name: name.trim(),
          birthday: isBirthdayFilled
            ? toIsoBirthday(birthDay, birthMonth, birthYear)
            : undefined,
          gender: gender ?? undefined,
        }),
        updateUserSettings({ measure }),
        saveDefaultMeasurement(measure),
      ]);
    },
    onSuccess: async () => {
      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ["userProfile"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.userSettings.all });
      goToApp();
    },
    onError: () =>
      Alert.alert("Error", "Could not save your details. Please try again."),
  });

  const handleSubmit = () => {
    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (!gender) {
      setError("Please choose a gender.");
      return;
    }

    // Birthday is optional, so it is only checked once the user has started
    // filling it in — a half-typed date is a mistake, an empty one is a choice.
    const isBirthdayTouched = Boolean(birthDay || birthMonth || birthYear);
    if (isBirthdayTouched) {
      const birthdayError = validateBirthday(birthDay, birthMonth, birthYear);
      if (birthdayError) {
        setError(birthdayError);
        return;
      }
    }

    setError(null);
    saveMutation.mutate();
  };

  const underlineColor = (field: FocusableField) =>
    focused === field ? palette.highlight : palette.cardBorderColor;

  return (
    <ThemedView className="flex-1">
      {/* Same ambient wash as the sign-in screen, so onboarding reads as its
          continuation rather than as the first settings page. */}
      <View
        pointerEvents="none"
        className="absolute -left-[80px] -top-[60px] h-[220px] w-[220px] rounded-full"
        style={{ backgroundColor: `${palette.highlight}22` }}
      />
      <View
        pointerEvents="none"
        className="absolute -bottom-[110px] -right-[70px] h-[260px] w-[260px] rounded-full"
        style={{ backgroundColor: `${palette.secondary}18` }}
      />

      <Pressable
        className="flex-1 px-6"
        onPress={Keyboard.dismiss}
        accessible={false}
        style={{
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 12,
        }}
      >
        <Reveal step={0}>
          <ThemedText
            className="text-xs font-bold tracking-[3px]"
            style={{ color: palette.highlight }}
          >
            HERCULE
          </ThemedText>
        </Reveal>

        <Reveal step={1}>
          <ThemedText className="mt-3 text-4xl font-extrabold leading-tight">
            Let&apos;s get you{"\n"}set up.
          </ThemedText>
        </Reveal>

        <View className="mt-9 gap-7">
          <Reveal step={2}>
            <FieldLabel>your name</FieldLabel>
            <ThemedTextInput
              value={name}
              onChangeText={(text) => {
                setName(text);
                setError(null);
              }}
              onFocus={() => setFocused("name")}
              onBlur={() => setFocused(null)}
              placeholder="Your name"
              placeholderTextColor={`${palette.mutedText}80`}
              className="pb-2 text-2xl font-semibold"
              style={{
                borderBottomWidth: 2,
                borderBottomColor: underlineColor("name"),
              }}
              maxLength={NAME_MAX_LENGTH}
              returnKeyType="done"
              autoCapitalize="words"
            />
          </Reveal>

          <Reveal step={3}>
            <FieldLabel>birthday · optional</FieldLabel>
            <View
              className="flex-row items-center pb-2"
              style={{
                borderBottomWidth: 2,
                borderBottomColor: underlineColor("birthday"),
              }}
            >
              <DatePart
                value={birthDay}
                placeholder="DD"
                width="w-11"
                maxLength={2}
                onFocus={() => setFocused("birthday")}
                onBlur={() => setFocused(null)}
                onChange={(numeric) => {
                  setBirthDay(numeric);
                  setError(null);
                  if (numeric.length === 2) monthRef.current?.focus();
                }}
              />
              <DateSlash />
              <DatePart
                inputRef={monthRef}
                value={birthMonth}
                placeholder="MM"
                width="w-11"
                maxLength={2}
                onFocus={() => setFocused("birthday")}
                onBlur={() => setFocused(null)}
                onChange={(numeric) => {
                  setBirthMonth(numeric);
                  setError(null);
                  if (numeric.length === 2) yearRef.current?.focus();
                }}
              />
              <DateSlash />
              <DatePart
                inputRef={yearRef}
                value={birthYear}
                placeholder="YYYY"
                width="w-20"
                maxLength={4}
                onFocus={() => setFocused("birthday")}
                onBlur={() => setFocused(null)}
                onChange={(numeric) => {
                  setBirthYear(numeric);
                  setError(null);
                }}
              />
            </View>
          </Reveal>

          <Reveal step={4}>
            <FieldLabel>gender</FieldLabel>
            <View className="flex-row flex-wrap gap-2">
              {GENDER_OPTIONS.map((option) => {
                const isSelected = gender === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => {
                      setGender(option.value);
                      setError(null);
                    }}
                    className="rounded-full border px-4 py-2.5 active:opacity-70"
                    style={{
                      backgroundColor: isSelected
                        ? palette.highlight
                        : `${palette.highlight}0F`,
                      borderColor: isSelected
                        ? palette.highlight
                        : palette.cardBorderColor,
                    }}
                  >
                    <ThemedText
                      className="text-sm font-semibold"
                      style={{
                        color: isSelected ? palette.background : palette.text,
                      }}
                    >
                      {option.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </Reveal>

          <Reveal step={5}>
            <FieldLabel>what you lift in</FieldLabel>
            <View className="flex-row gap-3">
              {MEASURE_OPTIONS.map((option) => {
                const isSelected = measure === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => setMeasure(option.value)}
                    className="flex-1 items-center rounded-2xl border py-4 active:opacity-80"
                    style={{
                      backgroundColor: isSelected
                        ? palette.highlight
                        : palette.cardBackground,
                      borderColor: isSelected
                        ? palette.highlight
                        : palette.cardBorderColor,
                    }}
                  >
                    <ThemedText
                      className="text-2xl font-extrabold"
                      style={{
                        color: isSelected ? palette.background : palette.text,
                      }}
                    >
                      {option.title}
                    </ThemedText>
                    <ThemedText
                      className="mt-0.5 text-xs"
                      style={{
                        color: isSelected
                          ? `${palette.background}CC`
                          : palette.mutedText,
                      }}
                    >
                      {option.caption}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </Reveal>
        </View>

        {/* Pushes the actions to the bottom without a ScrollView. */}
        <View className="flex-1 justify-end">
          {error && (
            <ThemedText
              className="mb-3 text-center text-sm"
              style={{ color: palette.danger }}
            >
              {error}
            </ThemedText>
          )}

          <Reveal step={6}>
            <Pressable
              onPress={handleSubmit}
              disabled={saveMutation.isPending}
              className="items-center rounded-2xl py-4 active:opacity-80"
              style={{
                backgroundColor: palette.highlight,
                opacity: saveMutation.isPending ? 0.6 : 1,
                shadowColor: palette.highlight,
                shadowOpacity: 0.35,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 8 },
                elevation: 8,
              }}
            >
              <ThemedText
                className="text-base font-bold"
                style={{ color: palette.background }}
              >
                {saveMutation.isPending ? "Saving..." : "Get started"}
              </ThemedText>
            </Pressable>
          </Reveal>
        </View>
      </Pressable>
    </ThemedView>
  );
}

function Reveal({
  step,
  children,
}: {
  step: number;
  children: React.ReactNode;
}) {
  return (
    <Animated.View
      entering={FadeInDown.delay(step * REVEAL_STEP_MS)
        .duration(420)
        .easing(Easing.out(Easing.quad))}
    >
      {children}
    </Animated.View>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  const theme = useColorScheme() ?? "light";

  return (
    <ThemedText
      className="mb-2 text-sm"
      style={{ color: Colors[theme].mutedText }}
    >
      {children}
    </ThemedText>
  );
}

function DateSlash() {
  const theme = useColorScheme() ?? "light";

  return (
    <ThemedText
      className="mx-1 text-2xl"
      style={{ color: `${Colors[theme].mutedText}66` }}
    >
      /
    </ThemedText>
  );
}

function DatePart({
  inputRef,
  value,
  placeholder,
  width,
  maxLength,
  onChange,
  onFocus,
  onBlur,
}: {
  inputRef?: React.RefObject<TextInput | null>;
  value: string;
  placeholder: string;
  width: string;
  maxLength: number;
  onChange: (numeric: string) => void;
  onFocus: () => void;
  onBlur: () => void;
}) {
  const theme = useColorScheme() ?? "light";

  return (
    <ThemedTextInput
      ref={inputRef}
      value={value}
      onChangeText={(text) =>
        onChange(text.replace(/\D/g, "").slice(0, maxLength))
      }
      onFocus={onFocus}
      onBlur={onBlur}
      placeholder={placeholder}
      placeholderTextColor={`${Colors[theme].mutedText}80`}
      className={`${width} text-2xl font-semibold`}
      keyboardType="number-pad"
      maxLength={maxLength}
    />
  );
}
