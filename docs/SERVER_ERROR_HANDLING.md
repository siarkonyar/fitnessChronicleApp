# Server Error Handling System

This document explains how to implement offline error handling for tRPC queries and mutations in the Fitness Chronicle app.

## Overview

The server error handling system automatically detects when network operations fail due to connectivity issues and provides users with helpful alerts and navigation options to the offline page. It also supports custom error handling for validation errors, server errors, and other custom error types.

## How It Works

1. **Automatic Detection**: The system monitors network errors from tRPC operations
2. **Smart Alerts**: Shows appropriate alerts based on connectivity status
3. **Navigation**: Automatically offers to redirect users to the offline page
4. **Fallback Handling**: Allows custom error handling for non-network errors

## Components

### 1. useServerErrorHandler Hook

This is the core hook that handles server errors:

```typescript
import { useServerErrorHandler } from "@/hooks/useServerErrorHandler";

const { handleQueryError, handleMutationError, handleError } = useServerErrorHandler();
```

**Functions:**
- `handleQueryError(error, customHandlers?)`: Handles errors from tRPC queries
- `handleMutationError(error, customHandlers?)`: Handles errors from tRPC mutations
- `handleError(error, operation, customHandlers?)`: Generic error handler



## Custom Error Handlers

The system supports custom error handlers for different types of errors:

```typescript
const customHandlers = {
  onOfflineError: (error) => {
    // Custom offline error handling
    console.log("Custom offline handling:", error);
    return true; // Error was handled
  },
  onServerError: (error) => {
    // Custom server error handling
    Alert.alert("Server Error", "Something went wrong on our end");
    return true; // Error was handled
  },
  onValidationError: (error) => {
    // Custom validation error handling
    Alert.alert("Validation Error", error.message);
    return true; // Error was handled
  }
};
```

## Usage Examples

### Method 1: Direct Hook Usage (Recommended)

#### For Queries

```typescript
import { useOfflineErrorHandler } from "@/hooks/useOfflineErrorHandler";

export default function MyComponent() {
  const { handleQueryError } = useOfflineErrorHandler();

  const { data, error } = trpc.fitness.getExerciseLogByDate.useQuery({
    date: new Date().toLocaleDateString("en-CA"),
  });

  // Handle errors automatically
  useEffect(() => {
    if (error) {
      handleQueryError(error);
    }
  }, [error, handleQueryError]);

  // ... rest of component
}
```

#### For Mutations

```typescript
import { useServerErrorHandler } from "@/hooks/useServerErrorHandler";

export default function MyComponent() {
  const { handleMutationError } = useServerErrorHandler();

  const mutation = trpc.fitness.addExerciseLog.useMutation({
    onError: (error) => {
      handleMutationError(error);
    },
  });

  // ... rest of component
}
```

### Method 2: Using ErrorBoundary Component

#### Basic Wrapping

```typescript
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function MyComponent() {
  const { data, error } = trpc.fitness.getExercises.useQuery();

  return (
    <ErrorBoundary error={error}>
      <View>
        {/* Your component content */}
        {data?.map(exercise => (
          <Text key={exercise.id}>{exercise.name}</Text>
        ))}
      </View>
    </ErrorBoundary>
  );
}
```

#### With Custom Error Handling

```typescript
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function MyComponent() {
  const { data, error } from trpc.fitness.getExercises.useQuery();

  const handleCustomError = (error) => {
    // Handle non-network errors (e.g., validation errors)
    console.log("Custom error handling:", error);
  };

  return (
    <ErrorBoundary error={error} onError={handleCustomError}>
      <View>
        {/* Your component content */}
      </View>
    </ErrorBoundary>
  );
}
```

### Method 3: Using Higher-Order Component (HOC)

#### Simple HOC Usage

```typescript
import { withErrorHandling } from "@/components/ErrorBoundary";

function MyComponent({ error }) {
  return (
    <View>
      {/* Your component content */}
    </View>
  );
}

// Automatically adds error handling
export default withErrorHandling(MyComponent, (props) => props.error);
```

#### HOC with Error Selector

```typescript
import { withErrorHandling } from "@/components/ErrorBoundary";

function MyComponent({ queryResult }) {
  return (
    <View>
      {/* Your component content */}
    </View>
  );
}

// Extract error from nested object
export default withErrorHandling(
  MyComponent,
  (props) => props.queryResult?.error
);
```

## Error Types Handled

The system automatically detects these network-related errors:

- Network request failures
- Fetch timeouts
- Connection refused errors
- DNS resolution failures
- General network connectivity issues

## User Experience

### When Offline
- Shows "You're Offline" alert
- Offers to redirect to offline page
- Allows cancellation

### When Connection Issues
- Shows "Connection Issue" alert
- Offers retry option
- Provides option to go offline

## Alert Messages

### Offline Alert
```
Title: "You're Offline"
Message: "This [query/mutation] cannot be completed while offline. You'll be redirected to the offline page where you can continue using the app."
Actions: ["Go to Offline Page", "Cancel"]
```

### Connection Issue Alert
```
Title: "Connection Issue"
Message: "Unable to complete this [query/mutation]. Please check your internet connection and try again."
Actions: ["Retry", "Go Offline"]
```

## Best Practices

1. **Always handle errors**: Use the offline error handlers for all tRPC operations
2. **Provide fallbacks**: Have offline alternatives for critical operations
3. **User guidance**: Clear messaging about what users can do when offline
4. **Consistent experience**: Use the same error handling pattern across the app

## Choosing the Right Method

### **Method 1: Direct Hook Usage** ⭐ **Recommended**
- **Use when**: You want full control over error handling
- **Best for**: New components, complex error logic
- **Pros**: Explicit, easy to debug, flexible
- **Cons**: More boilerplate code

### **Method 2: OfflineErrorBoundary Component**
- **Use when**: You want simple, declarative error handling
- **Best for**: Simple components, quick implementations
- **Pros**: Clean JSX, easy to understand
- **Cons**: Less flexible, harder to customize

### **Method 3: Higher-Order Component (HOC)**
- **Use when**: You want to add error handling without changing component logic
- **Best for**: Existing components, consistent error handling across many components
- **Pros**: Reusable, clean component code
- **Cons**: Can be harder to debug, less explicit

## Integration with Existing Code

To add server error handling to existing components:

1. Import the hook: `import { useServerErrorHandler } from "@/hooks/useServerErrorHandler"`
2. Get the handlers: `const { handleQueryError, handleMutationError } = useServerErrorHandler()`
3. Add error handling to queries using `useEffect`
4. Add error handling to mutations using `onError`

## Example: Complete Component

```typescript
import React, { useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useServerErrorHandler } from "@/hooks/useServerErrorHandler";

export default function ExerciseList() {
  const { handleQueryError, handleMutationError } = useServerErrorHandler();

  // Query with error handling
  const { data: exercises, error } = trpc.fitness.getExercises.useQuery();

  // Mutation with error handling
  const deleteMutation = trpc.fitness.deleteExercise.useMutation({
    onError: (error) => {
      handleMutationError(error);
    },
  });

  // Handle query errors
  useEffect(() => {
    if (error) {
      handleQueryError(error);
    }
  }, [error, handleQueryError]);

  // ... rest of component logic
}
```

## Troubleshooting

### Common Issues

1. **Errors not being caught**: Ensure you're using the error handlers correctly
2. **Multiple alerts**: Check that you're not calling error handlers multiple times
3. **Type errors**: Make sure you're importing from the correct paths

### Debug Mode

The system logs connectivity status and error details to the console for debugging purposes.

## Future Enhancements

- Automatic retry mechanisms
- Offline queue management
- Progressive web app features
- Background sync capabilities
