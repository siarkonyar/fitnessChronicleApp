// App.tsx
import React from "react";
import { ImageBackground, View } from "react-native";

import { QueryClientProvider } from "@tanstack/react-query"; // Directly import QueryClientProvider
import { queryClient, trpc, trpcClient } from "../lib/trpc";

import AuthPage from "../components/auth/AuthPage"; // Import the new component

export default function SignIn() {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <ImageBackground
          source={require("../assets/images/signin/signin-background.png")}
          style={{ flex: 1 }}
          resizeMode="cover"
        >
          {/* subtle black tint over background image */}
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0,0,0,0.80)",
            }}
          />
          {/* Render the actual content inside the providers */}
          <AuthPage />
        </ImageBackground>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
