import React, { useState } from "react";
import { View } from "react-native";
import { z } from "zod";
import { LabelWithIdSchema } from "../../types/types";
import { RoundedButton } from "../RoundButton";
import { ThemedText } from "../ThemedText";
import { ThemedTextInput } from "../ThemedTextInput";
import { ThemedView } from "../ThemedView";
import MutedCard from "./MuteCard";

interface LabelCardProps {
  index: number;
  label: z.infer<typeof LabelWithIdSchema>;
  onPress?: (labelId: string) => void;
  onSave?: (updatedLabel: z.infer<typeof LabelWithIdSchema>) => void;
  className?: string;
  editable?: boolean;
}

export default function LabelCard({
  index,
  label,
  editable,
  onPress,
  onSave,
  className,
}: LabelCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedLabel, setEditedLabel] = useState(label.label);
  const [editedDescription, setEditedDescription] = useState(label.description);

  function handlePress() {
    if (!isEditing && onPress) {
      onPress(label.id);
    }
  }

  function handleEditPress() {
    setIsEditing(true);
  }

  function handleSave() {
    if (onSave) {
      onSave({ ...label, label: editedLabel, description: editedDescription });
    }
    setIsEditing(false);
  }

  function handleCancel() {
    setEditedLabel(label.label);
    setEditedDescription(label.description);
    setIsEditing(false);
  }

  return (
    <MutedCard
      key={label.id ?? `${label.label}-${index}`}
      onPress={handlePress}
      className={`${className} flex items-center justify-between`}
    >
      <ThemedView className="flex-row items-center flex-1 min-w-0 mr-2">
        <View className="w-12 h-12 bg-white dark:bg-gray-800 rounded-full p-2 mr-4 shadow-sm justify-center items-center">
          {isEditing ? (
            <ThemedTextInput
              value={editedLabel}
              onChangeText={(t) => {
                const chars = Array.from(t);
                const last = chars[chars.length - 1] ?? "";
                setEditedLabel(last.toUpperCase());
              }}
              onKeyPress={({ nativeEvent: { key } }) => {
                if (key === "Backspace") return setEditedLabel("");
                if (
                  /[\p{L}\p{N}]/u.test(key) ||
                  /\p{Extended_Pictographic}/u.test(key)
                ) {
                  setEditedLabel(key.toUpperCase());
                }
              }}
              maxLength={1}
              caretHidden={false}
              autoCapitalize="characters"
              style={{
                fontWeight: "bold",
                fontSize: 18,
                textAlign: "center",
                textTransform: "uppercase",
              }}
              className="text-center"
            />
          ) : (
            <ThemedText
              className="leading-7"
              style={{ fontWeight: "bold", fontSize: 18 }}
            >
              {label.label}
            </ThemedText>
          )}
        </View>
        {isEditing ? (
          <ThemedTextInput
            value={editedDescription}
            onChangeText={setEditedDescription}
            className="text-base font-medium flex-1 border-b border-gray-400"
            autoFocus
          />
        ) : (
          <ThemedText className="text-base font-medium flex-1">
            {label.description}
          </ThemedText>
        )}
      </ThemedView>
      {editable ? (
        <ThemedView className="flex-row">
          {isEditing ? (
            <>
              <RoundedButton icon="check" onPress={handleSave} />
              <RoundedButton icon="delete" onPress={handleCancel} />
            </>
          ) : (
            <RoundedButton icon="edit" onPress={handleEditPress} />
          )}
        </ThemedView>
      ) : (
        <></>
      )}
    </MutedCard>
  );
}
