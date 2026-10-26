import { renderHook } from "@testing-library/react-native";
import React from "react";

/**
 * Renders a hook that is expected to throw, and returns what it threw.
 *
 * React 19 reports a render error that no boundary catches as uncaught, which
 * fails the test even when the rejected render is awaited. A boundary catches
 * it here instead, and React's report of the caught error is silenced.
 */
export async function renderHookError(useHook: () => unknown): Promise<Error | undefined> {
  let caught: Error | undefined;

  class Boundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
    state = { failed: false };

    static getDerivedStateFromError() {
      return { failed: true };
    }

    componentDidCatch(error: Error) {
      caught = error;
    }

    render() {
      return this.state.failed ? null : this.props.children;
    }
  }

  const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
  try {
    await renderHook(useHook, { wrapper: Boundary });
  } finally {
    consoleError.mockRestore();
  }
  return caught;
}
