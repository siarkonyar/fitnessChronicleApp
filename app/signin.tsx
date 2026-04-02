// App.tsx
import AuthPage from "@/components/auth/AuthPage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { ImageBackground, View } from "react-native";

const queryClient = new QueryClient();

export default function SignIn() {
  return (
    <QueryClientProvider client={queryClient}>
      <ImageBackground
        source={require("../assets/images/signin/signin-background.png")}
        style={{ flex: 1 }}
        resizeMode="cover"
      >
        {/* Layered tints keep the background visible while improving contrast. */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(7, 8, 12, 0.68)",
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(255, 69, 0, 0.05)",
          }}
        />
        {/* Render the actual content inside the providers */}
        <AuthPage />
      </ImageBackground>
    </QueryClientProvider>
  );
}
