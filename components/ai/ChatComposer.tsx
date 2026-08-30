import { RoundedButton } from "@/components/RoundButton";
import { ThemedText } from "@/components/ThemedText";
import AppTextInput from "@/components/ui/AppTextInput";
import { Colors } from "@/constants/Colors";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { useColorScheme, View } from "react-native";

const MAX_INPUT_HEIGHT_CLASS = "max-h-32";
const DISABLED_SEND_OPACITY = 0.4;
const DISABLED_INPUT_OPACITY = 0.5;

/** Hex alpha suffix: the banner is a wash of the danger colour, not a slab of it. */
const ERROR_TINT_ALPHA = "1A";

type ChatComposerProps = {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  disabled?: boolean;
  /** Shown directly above the input. null when there is nothing to report. */
  errorMessage?: string | null;
};

export default function ChatComposer({
  value,
  onChangeText,
  onSend,
  disabled = false,
  errorMessage = null,
}: ChatComposerProps) {
  const theme = useColorScheme() ?? "light";
  const canSend = value.trim().length > 0 && !disabled;

  return (
    // The border and background moved out to this wrapper so the banner sits
    // inside the composer's own surface rather than floating over the message
    // list — it belongs to the input, not to the conversation.
    <View
      className="border-t"
      style={{
        backgroundColor: Colors[theme].background,
        borderTopColor: Colors[theme].cardBorderColor,
      }}
    >
      {errorMessage ? (
        <View
          className="mx-4 mt-3 flex-row items-center gap-2 rounded-xl px-3 py-2"
          style={{
            backgroundColor: `${Colors[theme].danger}${ERROR_TINT_ALPHA}`,
          }}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          <Feather name="alert-circle" size={16} color={Colors[theme].danger} />
          <ThemedText
            className="flex-1 text-sm"
            style={{ color: Colors[theme].danger }}
          >
            {errorMessage}
          </ThemedText>
        </View>
      ) : null}

      <View className="flex-row items-center gap-2 px-4 py-3">
        <View className="flex-1">
          <AppTextInput
            value={value}
            onChangeText={onChangeText}
            placeholder="Ask your coach..."
            multiline
            editable={!disabled}
            className={`${MAX_INPUT_HEIGHT_CLASS} text-base`}
            style={{ opacity: disabled ? DISABLED_INPUT_OPACITY : 1 }}
          />
        </View>

        <RoundedButton
          icon="send"
          onPress={onSend}
          disabled={!canSend}
          style={{ opacity: canSend ? 1 : DISABLED_SEND_OPACITY }}
        />
      </View>
    </View>
  );
}
