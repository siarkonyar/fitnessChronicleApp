// App.tsx
import MyIcon from "@/components/LogoIcon";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import { queryKeys } from "@/constants/QueryKeys";
import { useAuth } from "@/context/AuthContext";
import { useConnectivity } from "@/context/ConnectivityContext";
import { useServerErrorHandler } from "@/hooks/useServerErrorHandler";
import {
  getExerciseLogByDate,
  getExerciseLogsByMonth,
} from "@/lib/firebase/exercise";
import {
  getAllLabels,
  getAllLabelsFromMonth,
  getLabelAsignmentByDate,
} from "@/lib/firebase/label";
import { updateStreak } from "@/lib/firebase/streaks";
import { getUserProfile } from "@/lib/firebase/user";
import { isProfileComplete } from "@/lib/profile";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import React, { useCallback, useEffect } from "react";
import { useColorScheme, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

export default function App() {
  const theme = useColorScheme() ?? "light";
  const { isAuthenticated, authLoading } = useAuth();
  const { handleQueryError, handleMutationError } = useServerErrorHandler();
  const { isOnline } = useConnectivity();

  const queryClient = useQueryClient();

  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.96);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const updateStreakMutation = useMutation({
    mutationFn: updateStreak,
    onError: (error) => {
      handleMutationError(error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.exerciseNames.all,
      });
    },
  });

  useEffect(() => {
    opacity.value = withTiming(1, {
      duration: 600,
      easing: Easing.out(Easing.quad),
    });
    scale.value = withTiming(1, {
      duration: 600,
      easing: Easing.out(Easing.quad),
    });
  }, [opacity, scale]);

  // Warm critical queries during splash
  useEffect(() => {
    const today = new Date().toLocaleDateString("en-CA");
    const visibleMonth = today.slice(0, 7);

    // Skip prefetching if offline to avoid noisy alerts on splash
    if (isAuthenticated && isOnline) {
      Promise.all([
        queryClient.prefetchQuery({
          queryKey: queryKeys.exerciseLogs.byMonth(visibleMonth),
          queryFn: () => getExerciseLogsByMonth(visibleMonth),
        }),
        queryClient.prefetchQuery({
          queryKey: queryKeys.labelAssignments.byMonth(visibleMonth),
          queryFn: () => getAllLabelsFromMonth(visibleMonth),
        }),
        queryClient.prefetchQuery({
          queryKey: queryKeys.exerciseLogs.byDate(today),
          queryFn: () => getExerciseLogByDate(today),
        }),
        queryClient.prefetchQuery({
          queryKey: queryKeys.labelAssignments.byDate(today),
          queryFn: () => getLabelAsignmentByDate(today),
        }),
        queryClient.prefetchQuery({
          queryKey: queryKeys.labels.all,
          queryFn: () => getAllLabels(),
        }),
      ]).catch((error) => {
        // Handle prefetch errors with offline redirection
        handleQueryError(error);
      });
    }
  }, [authLoading, isAuthenticated, isOnline, queryClient, handleQueryError]);

  const navigateAfterFade = useCallback(async () => {
    // If offline, always land on the offline experience
    /* if (!isOnline) {
      router.replace("/offline");
      return;
    } */
    if (!isAuthenticated) {
      router.replace("/signin");
      return;
    }

    // Checked on every launch rather than only at sign-up, so force-quitting
    // part-way through onboarding brings the user back to it instead of
    // dropping them into the app with a half-filled profile.
    try {
      const profile = await getUserProfile();
      router.replace(
        isProfileComplete(profile) ? "/(tabs)" : "/(screens)/onboarding",
      );
    } catch (error) {
      // A failed read (usually offline) must not strand the user on the
      // splash or trap them in onboarding they cannot submit. Let them in;
      // the next launch will ask again.
      console.warn("Could not read profile for onboarding check:", error);
      router.replace("/(tabs)");
    }
  }, [isAuthenticated]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      opacity.value = withTiming(
        0,
        {
          duration: 400,
          easing: Easing.in(Easing.quad),
        },
        (finished) => {
          if (finished) {
            runOnJS(navigateAfterFade)();
          }
        },
      );
    }, 2500);

    return () => clearTimeout(timeoutId);
  }, [isAuthenticated, navigateAfterFade, opacity]);

  useEffect(() => {
    try {
      updateStreakMutation.mutate(new Date());
    } catch (error) {
      console.log(error);
    }
  }, [updateStreakMutation]);

  return (
    <>
      <View
        style={{ backgroundColor: Colors[theme].background }}
        className="w-full h-full flex-1 justify-center items-center"
      >
        <Animated.View style={logoStyle}>
          <ThemedText>
            <MyIcon size={128} color={Colors[theme].highlight} />
          </ThemedText>
        </Animated.View>
      </View>
    </>
  );
}
