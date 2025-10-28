import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../lib/firebase"; // Firebase auth and firestore

interface AuthContextType {
  isAuthenticated: boolean;
  authLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  authLoading: true,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    try {
      if (!auth) {
        console.error("Auth not initialized");
        setAuthLoading(false);
        return;
      }

      const unsubscribe = auth.onAuthStateChanged(
        async (user) => {
          try {
            setIsAuthenticated(!!user);

            if (user) {
              // Upsert a user doc to verify access and track last login
              await setDoc(
                doc(db, "users", user.uid),
                { email: user.email, lastLogin: serverTimestamp() },
                { merge: true }
              );
              console.log(
                "AuthContext: user session active, Firestore updated",
                user.uid
              );
            }
          } catch (firestoreErr) {
            console.warn("AuthContext: failed to write user doc", firestoreErr);
          } finally {
            setAuthLoading(false);
          }
        },
        (error) => {
          console.error("Auth state change error:", error);
          setAuthLoading(false);
        }
      );

      return unsubscribe; // Cleanup listener on unmount
    } catch (error) {
      console.error("Auth initialization error:", error);
      setAuthLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, authLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
