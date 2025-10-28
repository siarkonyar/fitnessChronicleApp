// App.tsx
import MyIcon from "@/components/LogoIcon";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import { useAuth } from "@/context/AuthContext";
import { useConnectivity } from "@/context/ConnectivityContext";
import { useServerErrorHandler } from "@/hooks/useServerErrorHandler";
import { trpc } from "@/lib/trpc";
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
  const utils = trpc.useUtils();
  const { isOnline } = useConnectivity();

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
        utils.fitness.getExerciseLogsByMonth.prefetch({ month: visibleMonth }),
        utils.label.getAllLabelsFromMonth.prefetch({ date: visibleMonth }),
        utils.fitness.getExerciseLogByDate.prefetch({ date: today }),
        utils.label.getAllLabels.prefetch(),
      ]).catch((error) => {
        // Handle prefetch errors with offline redirection
        handleQueryError(error);
      });
    }
  }, [authLoading, isAuthenticated, isOnline, utils, handleQueryError]);

  const navigateAfterFade = useCallback(() => {
    // If offline, always land on the offline experience
    if (!isOnline) {
      router.replace("/offline");
      return;
    }
    if (isAuthenticated) {
      router.replace("/(tabs)");
    }
  }, [isAuthenticated, isOnline]);

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
        }
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
