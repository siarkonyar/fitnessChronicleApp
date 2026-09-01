import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import { REPORT_EMAIL_ADDRESS } from "@/lib/ai/report";
import { ChatMessageSchema } from "@/types/types";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Alert, Linking, TouchableOpacity, useColorScheme, View } from "react-native";
import { z } from "zod";

type ChatMessage = z.infer<typeof ChatMessageSchema>;

type ChatBubbleProps = {
  message: ChatMessage;
  /** The user message the coach was replying to, included for context. */
  precedingUserText?: string;
};

/**
 * Builds the mailto: link for reporting a coach answer.
 *
 * A plain mailto rather than a backend call: reporting is rare enough that a
 * Cloud Function and an email-sending service would be infrastructure this
 * feature does not earn. The user's own mail app sends it, so nothing is
 * stored on our servers before the user has explicitly opted to send it.
 */
const buildReportMailto = (
  reportedText: string,
  precedingUserText?: string,
): string => {
  const subject = "Reporting an AI coach answer";
  const context = precedingUserText
    ? `My message:\n${precedingUserText}\n\n`
    : "";
  const body = `${context}Coach's answer:\n${reportedText}\n\nWhat was wrong with this answer:\n`;

  return `mailto:${REPORT_EMAIL_ADDRESS}?subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(body)}`;
};

export default function ChatBubble({
  message,
  precedingUserText,
}: ChatBubbleProps) {
  const theme = useColorScheme() ?? "light";
  const isUser = message.role === "user";

  const handleReport = (): void => {
    const url = buildReportMailto(message.text, precedingUserText);

    Linking.openURL(url).catch(() => {
      Alert.alert(
        "Couldn't open Mail",
        `Please email ${REPORT_EMAIL_ADDRESS} to report this answer.`,
      );
    });
  };

  return (
    <View className={`mb-3 max-w-[85%] ${isUser ? "self-end" : "self-start"}`}>
      <View
        className="rounded-3xl px-4 py-2"
        style={{
          backgroundColor: isUser
            ? Colors[theme].highlight
            : Colors[theme].cardBackground,
          borderWidth: isUser ? 0 : 1,
          borderColor: Colors[theme].cardBorderColor,
        }}
      >
        {/* User bubbles sit on `highlight`, the same orange in both themes,
            so their text stays white regardless of color scheme. */}
        <ThemedText
          className="text-base"
          lightColor={isUser ? Colors.light.cardBackground : Colors.light.text}
          darkColor={isUser ? Colors.light.cardBackground : Colors.dark.text}
        >
          {message.text}
        </ThemedText>
      </View>

      {isUser ? null : (
        <TouchableOpacity
          onPress={handleReport}
          className="mt-1 flex-row items-center self-start px-1"
          accessibilityRole="button"
          accessibilityLabel="Report this answer"
        >
          <Feather name="flag" size={12} color={Colors[theme].mutedText} />
          <ThemedText
            className="ml-1 text-xs"
            style={{ color: Colors[theme].mutedText }}
          >
            Report
          </ThemedText>
        </TouchableOpacity>
      )}
    </View>
  );
}
