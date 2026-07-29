import { RoundedButton } from "@/components/RoundButton";
import AppTextInput from "@/components/ui/AppTextInput";
import { Colors } from "@/constants/Colors";
import React from "react";
import { useColorScheme, View } from "react-native";

const MAX_INPUT_HEIGHT_CLASS = "max-h-32";
const DISABLED_SEND_OPACITY = 0.4;

type ChatComposerProps = {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  disabled?: boolean;
};

export default function ChatComposer({
  value,
  onChangeText,
  onSend,
  disabled = false,
}: ChatComposerProps) {
  const theme = useColorScheme() ?? "light";
  const canSend = value.trim().length > 0 && !disabled;

  return (
    <View
      className="flex-row items-end gap-2 border-t px-4 py-3"
      style={{
        backgroundColor: Colors[theme].background,
        borderTopColor: Colors[theme].cardBorderColor,
      }}
    >
      <View className="flex-1">
        <AppTextInput
          value={value}
          onChangeText={onChangeText}
          placeholder="Ask your coach..."
          multiline
          editable={!disabled}
          className={`${MAX_INPUT_HEIGHT_CLASS} text-base`}
        />
      </View>

      <RoundedButton
        icon="send"
        onPress={onSend}
        disabled={!canSend}
        style={{ opacity: canSend ? 1 : DISABLED_SEND_OPACITY }}
      />
    </View>
  );
}
