import { logEvent } from "@/lib/analytics/client";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type ConnectivityContextValue = {
  isOnline: boolean;
  connectivityLoading: boolean;
  lastState?: NetInfoState;
  refresh: () => void;
  forceOffline: () => void;
  forceOnline: () => void;
};

const ConnectivityContext = createContext<ConnectivityContextValue | undefined>(
  undefined
);

export function ConnectivityProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [connectivityLoading, setConnectivityLoading] = useState<boolean>(true);
  const [lastState, setLastState] = useState<NetInfoState | undefined>(
    undefined
  );
  const [refreshTick, setRefreshTick] = useState<number>(0);
  const [isForced, setIsForced] = useState<boolean>(false);

  const checkConnectivity = async () => {
    try {
      const state = await NetInfo.fetch();
      setLastState(state);

      // More robust connectivity check
      const connected = Boolean(state.isConnected);
      const internetReachable = state.isInternetReachable !== false; // Default to true if undefined

      const online = connected && internetReachable;
      console.log("NetInfo State:", {
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
        type: state.type,
        online,
      });

      setIsOnline(online);
      setConnectivityLoading(false);
    } catch (error) {
      console.error("NetInfo fetch error:", error);
      // Fallback: assume offline if we can't check
      setIsOnline(false);
      setConnectivityLoading(false);
    }
  };

  useEffect(() => {
    if (isForced) return; // Don't override forced state

    setConnectivityLoading(true);

    // Initial check
    checkConnectivity();

    // Set up listener
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      if (isForced) return; // Don't override forced state

      setLastState(state);

      const connected = Boolean(state.isConnected);
      const internetReachable = state.isInternetReachable !== false;
      const online = connected && internetReachable;

      console.log("NetInfo Update:", {
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
        type: state.type,
        online,
      });

      setIsOnline(online);
      setConnectivityLoading(false);
    });

    return () => unsubscribe();
  }, [refreshTick, isForced]);

  // Reported on the TRANSITION into offline, not while offline. An effect that
  // simply checked `!isOnline` would fire again on every unrelated re-render
  // and turn one dropped connection into a stream of identical events.
  //
  // Seeded true because isOnline starts true: someone who opens the app with
  // no signal at all is a first render, not a user who lost connection, and
  // counting it as one would overstate how often the app drops out.
  const wasOnlineRef = useRef(true);

  useEffect(() => {
    if (wasOnlineRef.current && !isOnline) {
      logEvent("offline_mode_entered", {});
    }

    wasOnlineRef.current = isOnline;
  }, [isOnline]);

  const value = useMemo<ConnectivityContextValue>(
    () => ({
      isOnline,
      connectivityLoading,
      lastState,
      refresh: () => {
        setIsForced(false);
        setRefreshTick((n) => n + 1);
      },
      forceOffline: () => {
        setIsForced(true);
        setIsOnline(false);
        setConnectivityLoading(false);
      },
      forceOnline: () => {
        setIsForced(true);
        setIsOnline(true);
        setConnectivityLoading(false);
      },
    }),
    [isOnline, connectivityLoading, lastState]
  );

  return (
    <ConnectivityContext.Provider value={value}>
      {children}
    </ConnectivityContext.Provider>
  );
}

export function useConnectivity(): ConnectivityContextValue {
  const ctx = useContext(ConnectivityContext);
  if (!ctx) {
    throw new Error("useConnectivity must be used within ConnectivityProvider");
  }
  return ctx;
}
