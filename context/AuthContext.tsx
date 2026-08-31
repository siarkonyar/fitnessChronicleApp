import {
  FirebaseAuthTypes,
  signOut as firebaseSignOut,
  getAuth,
  onAuthStateChanged,
} from "@react-native-firebase/auth";
import { logEvent } from "@/lib/analytics/client";
import { deleteAccount } from "@/lib/firebase/account";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import React, { createContext, useContext, useEffect, useState } from "react";

interface AuthContextType {
  user: FirebaseAuthTypes.User | null;
  isAuthenticated: boolean;
  authLoading: boolean;
  signOut: () => Promise<void>;
  getIdToken: (forceRefresh?: boolean) => Promise<string | null>;
  refreshUser: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    // Subscribe to authentication state changes
    const subscriber = onAuthStateChanged(getAuth(), (firebaseUser) => {
      setUser(firebaseUser);
      if (authLoading) {
        setAuthLoading(false);
      }
    });

    // Unsubscribe on unmount
    return subscriber;
  }, [authLoading]);

  const signOut = async () => {
    try {
      // Sign out from Google to allow account selection on next sign-in
      await GoogleSignin.revokeAccess();
      await GoogleSignin.signOut();
    } catch (error) {
      console.warn("Google Sign-Out Error:", error);
      // Continue with Firebase sign out even if Google sign out fails
    }

    try {
      // Sign out from Firebase
      await firebaseSignOut(getAuth());

      // Before useAnalyticsConsent reacts to the auth change and switches
      // collection off — after that point nothing can be reported.
      logEvent("logout", {});
    } catch (error) {
      console.error("Firebase Sign-Out Error:", error);
      throw error;
    }
  };

  const getIdToken = async (
    forceRefresh: boolean = false
  ): Promise<string | null> => {
    try {
      if (!user) {
        return null;
      }
      const token = await user.getIdToken(forceRefresh);
      return token;
    } catch (error) {
      console.error("Error getting ID token:", error);
      return null;
    }
  };

  const refreshUser = async () => {
    const currentUser = getAuth().currentUser;
    if (!currentUser) return;
    await currentUser.reload();
    setUser(getAuth().currentUser);
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    authLoading,
    signOut,
    getIdToken,
    refreshUser,
    deleteAccount,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

