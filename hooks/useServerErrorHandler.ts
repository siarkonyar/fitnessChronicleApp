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
          `This ${operation} cannot be completed while offline. You'll be redirected to the offline page where you can continue using the app.`,
          [
            {
              text: "Go to Offline Page",
              onPress: () => {
                router.push("/offline");
              },
            },
            {
              text: "Cancel",
              style: "cancel",
            },
          ]
        );
        return true; // Error was handled
      }

      // If it's a network error but we think we're online, show connection alert
      if (isNetworkError && isOnline) {
        Alert.alert(
          "Connection Issue",
          `Unable to complete this ${operation}. Please check your internet connection and try again.`,
          [
            {
              text: "Retry",
              onPress: () => {
                router.reload();
                // The user can retry manually
              },
            },
            {
              text: "Go Offline",
              onPress: () => {
                router.replace("/offline");
              },
            },
          ]
        );
        return true; // Error was handled
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
