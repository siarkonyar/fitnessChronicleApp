import { useConnectivity } from "@/context/ConnectivityContext";
import { router, usePathname } from "expo-router";
import * as Updates from "expo-updates";
import { useCallback } from "react";
import { Alert } from "react-native";

// Global state to track if offline alert is showing
let isOfflineAlertShowing = false;

export function useServerErrorHandler() {
  const { isOnline } = useConnectivity();
  const pathname = usePathname();

  const handleError = useCallback(
    (error: any, operation: "query" | "mutation", customHandlers?: {
      onOfflineError?: (error: any) => boolean;
      onServerError?: (error: any) => boolean;
      onValidationError?: (error: any) => boolean;
    }) => {
      // Check if the error is network-related
      const isNetworkError =
        error?.message?.includes("Network request failed") ||
        error?.message?.includes("fetch") ||
        error?.message?.includes("timeout") ||
        error?.message?.includes("ECONNREFUSED") ||
        error?.message?.includes("ENOTFOUND") ||
        error?.code === "NETWORK_ERROR" ||
        error?.code === "TIMEOUT" ||
        error?.code === "CONNECTION_REFUSED";

      // Check if it's a validation error
      const isValidationError =
        error?.code === "BAD_REQUEST" ||
        error?.code === "VALIDATION_ERROR" ||
        error?.message?.includes("validation") ||
        error?.message?.includes("invalid");

      // Check if it's a server error
      const isServerError =
        error?.code === "INTERNAL_SERVER_ERROR" ||
        error?.code === "SERVICE_UNAVAILABLE" ||
        error?.status >= 500;

      // Handle validation errors first (if custom handler provided)
      if (isValidationError && customHandlers?.onValidationError) {
        const wasHandled = customHandlers.onValidationError(error);
        if (wasHandled) return true;
      }

      // Handle server errors (if custom handler provided)
      if (isServerError && customHandlers?.onServerError) {
        const wasHandled = customHandlers.onServerError(error);
        if (wasHandled) return true;
      }

      // If it's a network error and we're offline, show offline alert
      if (isNetworkError && !isOnline) {
        // Don't show offline alert if we're already on the offline page or offline log exercise page
        if (pathname === "/offline" || pathname === "/offline/logExercise") {
          console.log("Network error on offline page - not showing alert");
          return true; // Error was handled silently
        }

        // Don't show alert if one is already showing
        if (isOfflineAlertShowing) {
          console.log("Offline alert already showing - skipping");
          return true; // Error was handled silently
        }

        // Use custom offline handler if provided
        if (customHandlers?.onOfflineError) {
          const wasHandled = customHandlers.onOfflineError(error);
          if (wasHandled) return true;
        }

        // Set flag to prevent multiple alerts
        isOfflineAlertShowing = true;

        // Default offline behavior
        Alert.alert(
          "You're Offline",
          "You're not connected to the internet — but don't worry! 🙂 On the offline page you can still log exercises. 💪",
          [
            {
              text: "Go to Offline Page",
              onPress: () => {
                isOfflineAlertShowing = false; // Reset flag when user interacts
                router.push("/offline");
              },
            },
            {
              text: "Retry",
              /* style: "cancel", */
              onPress: async () => {
                isOfflineAlertShowing = false; // Reset flag when user interacts
                try {
                  await Updates.reloadAsync(); // This reloads the app like a fresh start
                } catch (e) {
                  console.error("Error reloading app:", e);
                }
              },
            },
          ],
          {
            onDismiss: () => {
              isOfflineAlertShowing = false; // Reset flag when alert is dismissed
            },
          }
        );
        return true; // Error was handled
      }

      // If it's a network error but we think we're online, just log it silently
      // The queries will retry automatically when connection is restored
      if (isNetworkError && isOnline) {
        console.log(`Network error detected while online for ${operation}:`, error);
        return true; // Error was handled silently
      }

      return false; // Error was not handled
    },
    [isOnline, pathname]
  );

  const handleQueryError = useCallback(
    (error: any, customHandlers?: {
      onOfflineError?: (error: any) => boolean;
      onServerError?: (error: any) => boolean;
      onValidationError?: (error: any) => boolean;
    }) => handleError(error, "query", customHandlers),
    [handleError]
  );

  const handleMutationError = useCallback(
    (error: any, customHandlers?: {
      onOfflineError?: (error: any) => boolean;
      onServerError?: (error: any) => boolean;
      onValidationError?: (error: any) => boolean;
    }) => handleError(error, "mutation", customHandlers),
    [handleError]
  );

  return {
    handleError,
    handleQueryError,
    handleMutationError,
  };
}
