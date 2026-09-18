import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import { queryKeys } from "@/constants/QueryKeys";
import { useServerErrorHandler } from "@/hooks/useServerErrorHandler";
import { logEvent } from "@/lib/analytics/client";
import {
  asignLabelToDay,
  deleteAssignment,
  getLabelAsignmentByDate,
} from "@/lib/firebase/label";
import { LabelSchema } from "@/types/types";
import { Feather } from "@expo/vector-icons";
import {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  useColorScheme,
  useWindowDimensions,
  View,
} from "react-native";
import { Button } from "../Button";
import LabelCard from "../cards/LabelCard";
import LabelList from "../lists/LabelList";
import { RoundedButton } from "../RoundButton";
import { ThemedView } from "../ThemedView";

// Represents an label assignment joined with its label data
export type DateLabelAssignmentWithLabel = {
  id: string;
  date: string; // ISO string (e.g., 2025-08-12)
  labelId: string;
  label: typeof LabelSchema;
};

export default function DateLabelAssignment({
  buttonText,
  selectedDate,
}: {
  buttonText: string;
  selectedDate: string;
}) {
  const theme = useColorScheme() ?? "light";

  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => [], []);

  const { height } = useWindowDimensions();
  const maxDynamicContentSize = height * 0.85;

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
      />
    ),
    [],
  );

  const { handleMutationError, handleQueryError } = useServerErrorHandler();
  const queryClient = useQueryClient();

  const [isAssigningLabel, setIsAssigningLabel] = React.useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.labelAssignments.byDate(selectedDate),
    queryFn: () => getLabelAsignmentByDate(selectedDate),
  });

  const invalidateLabelCaches = () => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.labelAssignments.all,
    });
    queryClient.invalidateQueries({
      queryKey: ["labels", "prevExercises"],
    });
  };

  const asignLabelToDayMutation = useMutation({
    mutationFn: asignLabelToDay,
    onError: (error) => {
      handleMutationError(error);
    },
    onSuccess: () => {
      logEvent("label_assigned", {});
      invalidateLabelCaches();
    },
  });
  const deleteAssignedLabelMutation = useMutation({
    mutationFn: deleteAssignment,
    onError: (error) => {
      handleMutationError(error);
    },
    onSuccess: invalidateLabelCaches,
  });

  useEffect(() => {
    if (error) {
      handleQueryError(error);
    }
  }, [error, handleQueryError]);

  //TODO: after clicking on an label it shows the loading screen but right after that for a split second it shows the card again. it happens so fast but it is still annoying to see
  async function handleAsignLabelToDay(labelId: string) {
    try {
      setIsAssigningLabel(true);
      await asignLabelToDayMutation.mutateAsync({
        date: selectedDate,
        labelId: labelId,
      });

      bottomSheetModalRef.current?.dismiss();
      setIsAssigningLabel(false);
    } catch (error) {
      console.error("Failed to assign label to day:", error);
      setIsAssigningLabel(false);
      bottomSheetModalRef.current?.dismiss();
    }
  }
  function handleDeleteAssignedLabel() {
    deleteAssignedLabelMutation.mutate(selectedDate, {
      onSuccess: () => bottomSheetModalRef.current?.dismiss(),
    });
  }

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center py-8">
        <ThemedText className="text-center opacity-70">Loading...</ThemedText>
      </View>
    );
  }

  return (
    <>
      <ThemedView className="flex-row px-4 justify-center items-center">
        {data ? (
          <>
            <LabelCard
              label={data}
              index={0}
              onPress={() => bottomSheetModalRef.current?.present()}
            />
          </>
        ) : (
          <Button onPress={() => bottomSheetModalRef.current?.present()}>
            {buttonText}
          </Button>
        )}
      </ThemedView>

      <BottomSheetModal
        ref={bottomSheetModalRef}
        index={0}
        snapPoints={snapPoints}
        maxDynamicContentSize={maxDynamicContentSize}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: Colors[theme].background }}
        handleIndicatorStyle={{ backgroundColor: Colors[theme].separator }}
      >
        <BottomSheetScrollView>
          <KeyboardAvoidingView
            keyboardVerticalOffset={-90}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            className="flex-1"
          >
            <View className="flex-row items-center px-5 pb-4">
              <View className="flex-1 mr-3">
                <ThemedText className="text-xl font-bold" numberOfLines={1}>
                  Choose Label
                </ThemedText>
                <ThemedText
                  className="text-sm"
                  lightColor={Colors.light.mutedText}
                  darkColor={Colors.dark.mutedText}
                  numberOfLines={1}
                >
                  {selectedDate}
                </ThemedText>
              </View>
              <RoundedButton
                type="danger"
                icon="x"
                onPress={() => bottomSheetModalRef.current?.dismiss()}
              />
            </View>

            {data ? (
              <View
                className="mx-5 mb-4 flex-row items-center justify-between rounded-2xl border px-4 py-3"
                style={{
                  backgroundColor: `${Colors[theme].highlight}18`,
                  borderColor: `${Colors[theme].highlight}30`,
                }}
              >
                <View className="mr-3 flex-1">
                  <ThemedText
                    className="text-xs font-semibold uppercase"
                    style={{ color: Colors[theme].highlight }}
                    numberOfLines={1}
                  >
                    Currently assigned
                  </ThemedText>
                  <ThemedText
                    className="text-base font-bold uppercase"
                    numberOfLines={1}
                  >
                    {data.label} {data.description}
                  </ThemedText>
                </View>
                <Pressable
                  onPress={handleDeleteAssignedLabel}
                  className="flex-row items-center rounded-full px-3 py-2 active:opacity-70"
                  style={{ backgroundColor: `${Colors[theme].danger}1A` }}
                >
                  <Feather name="x" size={14} color={Colors[theme].danger} />
                  <ThemedText
                    className="ml-1 text-sm font-semibold"
                    style={{ color: Colors[theme].danger }}
                  >
                    Unselect
                  </ThemedText>
                </Pressable>
              </View>
            ) : null}

            {isAssigningLabel ? (
              <ActivityIndicator
                size="large"
                color={Colors[theme].highlight}
                className="mb-4"
              />
            ) : (
              <ThemedView className="p-4">
                <LabelList labelOnPress={handleAsignLabelToDay} />
              </ThemedView>
            )}
          </KeyboardAvoidingView>
        </BottomSheetScrollView>
      </BottomSheetModal>
    </>
  );
}
