import { queryKeys } from "@/constants/QueryKeys";
import { useServerErrorHandler } from "@/hooks/useServerErrorHandler";
import { deleteLabel, editLabel } from "@/lib/firebase/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { Alert, View } from "react-native";
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
  className?: string;
  editable?: boolean;
}

export default function LabelCard({
  index,
  label,
  editable,
  onPress,
  className,
}: LabelCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
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

  const { handleMutationError, handleQueryError } = useServerErrorHandler();
  const queryClient = useQueryClient();
  const editLabelMutation = useMutation({
    mutationFn: ({
      id,
      label,
      description,
    }: {
      id: string;
      label: string;
      description: string;
    }) => editLabel(id, { label, description }),
    onError: (error) => {
      handleMutationError(error);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.labels.byId(variables.id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.labels.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.labelAssignments.all,
      });
    },
  });

  const deleteLabelMutation = useMutation({
    mutationFn: ({ id }: { id: string }) => deleteLabel(id),
    onError: (error) => {
      handleMutationError(error);
    },
    onSuccess: (variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.labels.byId(variables.id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.labels.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.labelAssignments.all,
      });
    },
  });

  async function handleEditLabel() {
    try {
      setIsEditing(true);
      await editLabelMutation.mutateAsync({
        id: label.id,
        label: editedLabel.trim(),
        description: editedDescription.trim(),
      });
    } catch (error) {
      console.log(error);
    } finally {
      setIsEditing(false);
    }
  }

  async function handleDeleteLabel() {
    if (!label.id) return;
    Alert.alert("Delete Label", "Are you sure you want to delete this label?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            setIsDeleting(true);
            await deleteLabelMutation.mutateAsync({ id: label.id });
          } catch (error) {
            console.log(error);
          } finally {
            setIsDeleting(false);
          }
        },
      },
    ]);
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
              <RoundedButton icon="check" onPress={handleEditLabel} />
              <RoundedButton
                type="red"
                icon="delete"
                onPress={handleDeleteLabel}
              />
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
