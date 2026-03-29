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
import { getAllLabels, getAllLabelsFromMonth } from "@/lib/firebase/label";
import { useQueryClient } from "@tanstack/react-query";
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
  const { handleQueryError } = useServerErrorHandler();
  const { isOnline } = useConnectivity();
  const queryClient = useQueryClient();

  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.96);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

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
          queryFn: () => getExerciseLogByDate(today),
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

  const navigateAfterFade = useCallback(() => {
    // If offline, always land on the offline experience
    /* if (!isOnline) {
      router.replace("/offline");
      return;
    } */
    if (isAuthenticated) {
      router.replace("/(tabs)");
    } else {
      router.replace("/signin");
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
