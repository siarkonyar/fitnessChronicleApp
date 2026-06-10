import { Colors } from "@/constants/Colors";
import { queryKeys } from "@/constants/QueryKeys";
import { useServerErrorHandler } from "@/hooks/useServerErrorHandler";
import { deleteLabel, editLabel } from "@/lib/firebase/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
import { Alert, useColorScheme } from "react-native";
import { z } from "zod";
import { LabelWithIdSchema } from "../../types/types";
import { RoundedButton } from "../RoundButton";
import { ThemedText } from "../ThemedText";
import { ThemedTextInput } from "../ThemedTextInput";
import { ThemedView } from "../ThemedView";
import IconBadge from "../ui/IconBadge";
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
  const theme = useColorScheme() ?? "light";
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editedLabel, setEditedLabel] = useState(label.label);
  const [editedDescription, setEditedDescription] = useState(label.description);

  useEffect(() => {
    setEditedLabel(label.label);
    setEditedDescription(label.description);
  }, [label.label, label.description]);

  function handlePress() {
    if (!isEditing && onPress) {
      onPress(label.id);
    }
  }

  function handleEditPress() {
    setIsEditing(true);
  }

  const { handleMutationError } = useServerErrorHandler();
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
            setIsEditing(false);
          }
        },
      },
    ]);
  }

  return (
    <MutedCard
      key={label.id ?? `${label.label}-${index}`}
      onPress={handlePress}
      className={`${className} items-center justify-between`}
    >
      <ThemedView
        className={`flex-row items-center ${editable ? "flex-1" : ""} min-w-0 mr-2`}
      >
        <IconBadge className="mr-4">
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
                fontSize: 22,
                textAlign: "center",
                textTransform: "uppercase",
                color: Colors[theme].highlight,
              }}
              className="text-center"
            />
          ) : (
            <ThemedText
              style={{
                fontSize: 24,
                lineHeight: 28,
                includeFontPadding: false,
                textAlignVertical: "center",
              }}
            >
              {label.label}
            </ThemedText>
          )}
        </IconBadge>
        {isEditing ? (
          <ThemedTextInput
            value={editedDescription}
            onChangeText={setEditedDescription}
            className="text-base font-medium flex-1 border-b border-gray-400"
            autoFocus
          />
        ) : (
          <ThemedText
            className={`text-base font-medium ${editable ? "flex-1" : ""}`}
          >
            {label.description}
          </ThemedText>
        )}
      </ThemedView>
      {editable ? (
        <ThemedView className="flex-row">
          {isEditing ? (
            <>
              <RoundedButton icon="check" type="blue" onPress={handleEditLabel} />
              <RoundedButton
                type="danger"
                icon="delete"
                onPress={handleDeleteLabel}
              />
            </>
          ) : (
            <RoundedButton icon="edit" type="blue" onPress={handleEditPress} />
          )}
        </ThemedView>
      ) : (
        <></>
      )}
    </MutedCard>
  );
}
