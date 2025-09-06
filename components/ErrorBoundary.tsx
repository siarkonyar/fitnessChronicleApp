import { useServerErrorHandler } from "@/hooks/useServerErrorHandler";
import React, { useEffect } from "react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  error?: any;
  onError?: (error: any) => void;
  customHandlers?: {
    onOfflineError?: (error: any) => boolean;
    onServerError?: (error: any) => boolean;
    onValidationError?: (error: any) => boolean;
  };
}

export function ErrorBoundary({
  children,
  error,
  onError,
  customHandlers,
}: ErrorBoundaryProps) {
  const { handleError } = useServerErrorHandler();

  useEffect(() => {
    if (error) {
      // Try to handle errors first
      const wasHandled = handleError(error, "query", customHandlers);

      // If not handled by error handler, call the original onError
      if (!wasHandled && onError) {
        onError(error);
      }
    }
  }, [error, handleError, onError, customHandlers]);

  return <>{children}</>;
}

// HOC for wrapping components that use tRPC queries
export function withErrorHandling<P extends object>(
  Component: React.ComponentType<P>,
  errorSelector?: (props: P) => any,
  customHandlers?: {
    onOfflineError?: (error: any) => boolean;
    onServerError?: (error: any) => boolean;
    onValidationError?: (error: any) => boolean;
  }
) {
  return function WrappedComponent(props: P) {
    const { handleQueryError } = useServerErrorHandler();
    const error = errorSelector ? errorSelector(props) : undefined;

    useEffect(() => {
      if (error) {
        handleQueryError(error, customHandlers);
      }
    }, [error, handleQueryError, customHandlers]);

    return <Component {...props} />;
  };
}
