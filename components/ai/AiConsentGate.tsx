import { ThemedText } from "@/components/ThemedText";
import { TintedButton } from "@/components/TintedButton";
import { Colors } from "@/constants/Colors";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { useColorScheme, View } from "react-native";

type AiConsentGateProps = {
  onEnable: () => void;
  isEnabling: boolean;
};

/**
 * Blocks the AI coach until the user explicitly opts in.
 *
 * This is deliberately a separate, standalone screen rather than a checkbox
 * folded into onboarding or the sign-in footer. Sending a message here sends
 * it, and training data read on the user's behalf, to Google's Gemini API —
 * a distinct and higher-risk purpose than the rest of the app, so it gets its
 * own explicit, specific opt-in rather than riding along on a general
 * "by signing in you agree" acceptance. A full screen was chosen over a
 * native Alert because Alert cannot fit an honest explanation of what leaves
 * the device.
 *
 * There is no "Not now" button. Declining has nowhere useful to go on this
 * screen — the user simply switches to another tab, and this gate is what
 * they see next time they come back, exactly like the feature stays off
 * until they choose otherwise in Settings.
 */
export default function AiConsentGate({
  onEnable,
  isEnabling,
}: AiConsentGateProps) {
  const theme = useColorScheme() ?? "light";

  return (
    <View
      className="flex-1 items-center justify-center px-8"
      style={{ backgroundColor: Colors[theme].background }}
    >
      <Feather name="shield" size={40} color={Colors[theme].highlight} />

      <ThemedText type="subtitle" className="mt-4 text-center">
        Turn on the AI Coach?
      </ThemedText>

      <ThemedText
        className="mt-3 text-center leading-5"
        style={{ color: Colors[theme].mutedText }}
      >
        To answer you, the coach sends the message you type — and, when it
        needs context, the workouts, labels, or programs it reads on your
        behalf — to Google&apos;s Gemini API. Your name, gender, birthday, and
        email are never included.
      </ThemedText>

      <ThemedText
        className="mt-3 text-center leading-5"
        style={{ color: Colors[theme].mutedText }}
      >
        You can turn this off again at any time in Settings.
      </ThemedText>

      <View className="mt-6 w-full">
        <TintedButton
          onPress={onEnable}
          disabled={isEnabling}
          style={{
            backgroundColor: Colors[theme].highlight,
            borderColor: Colors[theme].highlight,
          }}
          textStyle={{ color: Colors[theme].background }}
        >
          Enable AI Coach
        </TintedButton>
      </View>
    </View>
  );
}
