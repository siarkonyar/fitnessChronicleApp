import React, { createContext, useContext, useEffect, useState } from "react";
import { auth } from "../lib/firebase"; // Import Firebase auth

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
        (user) => {
          setIsAuthenticated(!!user); // Set to true if user exists, false otherwise
          setAuthLoading(false); // Stop loading once auth state is determined
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
