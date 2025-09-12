import { useConnectivity } from "@/context/ConnectivityContext";
import { router } from "expo-router";
import { useCallback } from "react";
import { Alert } from "react-native";

export function useServerErrorHandler() {
  const { isOnline } = useConnectivity();

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
        // Use custom offline handler if provided
        if (customHandlers?.onOfflineError) {
          const wasHandled = customHandlers.onOfflineError(error);
          if (wasHandled) return true;
        }

        // Default offline behavior
        Alert.alert(
          "You're Offline",
          "You're not connected to the internet — but don't worry! 🙂 On the offline page you can still log exercises. 💪",
          [
            {
              text: "Go to Offline Page",
              onPress: () => {
                router.push("/offline");
              },
            },
            {
              text: "Retry",
              /* style: "cancel", */
              onPress: () => {
                router.push("/");
              },
            },
          ]
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
    [isOnline]
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
