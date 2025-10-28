import { Colors } from "@/constants/Colors";
import { auth } from "@/lib/firebase";
import * as Google from "expo-auth-session/providers/google";
import { BlurView } from "expo-blur";
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { useEffect, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { SvgXml } from "react-native-svg";

export default function GoogleAuth() {
  const [loading, setLoading] = useState(false);
  const theme = useColorScheme() ?? "light";
  // Keep some transparency so the blur is visible. 0x40 ≈ 25% alpha.
  const highlightWithAlpha = `${Colors[theme].highlight}40`;
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID!,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID!,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID!,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID!,
    scopes: ["profile", "email"],
  });
  useEffect(() => {
    if (!response) return;

    if (response.type === "success" && response.authentication?.idToken) {
      const cred = GoogleAuthProvider.credential(
        response.authentication.idToken,
        response.authentication.accessToken ?? undefined
      );
      setLoading(true);
      signInWithCredential(auth, cred)
        .catch((err) => {
          console.warn("Firebase signInWithCredential error", err);
          Alert.alert("Sign-in failed", "Please try again.");
        })
        .finally(() => setLoading(false));
      return;
    }

    if (response.type === "cancel") {
      console.log("Google sign-in cancelled by user");
      setLoading(false);
    } else if (response.type === "dismiss") {
      console.log("Google sign-in dismissed");
    } else if (response.type === "error") {
      console.warn("Google sign-in error", response.error);
      Alert.alert("Sign-in error", response.error?.message ?? "Unknown error");
    }
  }, [response]);

  return (
    <View className="mt-4 items-center flex-col justify-center">
      {Platform.OS === "ios" && (
        <Pressable
          disabled={!request || loading}
          onPress={() => {
            setLoading(true);
            promptAsync().catch((err) => {
              console.warn("promptAsync error", err);
              Alert.alert("Could not start sign-in", "Please try again.");
              setLoading(false);
            });
          }}
          style={{ opacity: !request || loading ? 0.7 : 1 }}
          className="mb-6"
        >
          <BlurView
            intensity={50}
            tint={"dark"}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 16,
              borderRadius: 8,
              backgroundColor: highlightWithAlpha,
              overflow: "hidden",
            }}
          >
            <View className="flex-row items-center">
              <SvgXml
                width={28}
                height={28}
                xml={`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 315" width="28" height="28" preserveAspectRatio="xMidYMid meet">
                <path fill="white" d="M213.803 167.923c0 45.553 36.983 61.04 37.408 61.263-.416 1.33-5.867 20.27-19.307 40.2-11.645 17.03-23.74 34.013-42.77 34.34-18.86.33-24.904-11.108-46.46-11.108-21.556 0-28.047 10.735-45.764 11.44-18.378.72-32.44-18.422-44.16-35.395-24.096-35.06-42.547-99.05-17.77-142.313 12.284-21.3 34.25-34.8 58.06-35.13 18.095-.35 35.153 12.267 46.46 12.267 11.307 0 31.836-15.146 53.64-12.927 9.136.376 34.756 3.7 50.64 27.787-1.33.823-30.356 17.664-29.678 52.575z"/>
                  <path fill="white" transform="translate(15 30)" d="M175.053 0c-13.34.883-29.232 9.16-38.823 19.92-8.51 9.523-15.77 24.692-13.72 39.18 14.676 1.12 29.69-7.514 38.823-18.797 8.73-10.695 15.43-25.91 13.72-40.303z"/>
              </svg>`}
              />
              <Text
                style={{
                  fontSize: 16,
                  color: "white",
                  fontWeight: "600",
                  marginLeft: 8,
                }}
              >
                Sign in with Apple
              </Text>
            </View>
          </BlurView>
        </Pressable>
      )}
      <Pressable
        disabled={!request || loading}
        onPress={() => {
          setLoading(true);
          promptAsync().catch((err) => {
            console.warn("promptAsync error", err);
            Alert.alert("Could not start sign-in", "Please try again.");
            setLoading(false);
          });
        }}
        style={{ opacity: !request || loading ? 0.7 : 1 }}
      >
        <BlurView
          intensity={50}
          tint={"dark"}
          style={{
            paddingVertical: 10,
            paddingHorizontal: 16,
            borderRadius: 8,
            backgroundColor: highlightWithAlpha,
            overflow: "hidden",
          }}
        >
          <View className="flex-row items-center">
            <SvgXml
              width={28}
              height={28}
              xml={`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 256 262" preserveAspectRatio="xMidYMid meet">
                <path fill="#4285F4" d="M255.9 133.5c0-10.7-.9-21-2.7-31H130v58h71.9c-3.1 16.7-12.6 30.9-26.9 40.4v33h43.6c25.6-23.6 40.3-58.5 40.3-100.4z"/>
                <path fill="#34A853" d="M130 261c36.4 0 66.9-12 89.2-32.6l-43.6-33c-12.1 8.1-27.6 12.9-45.6 12.9-35.1 0-64.9-23.7-75.5-55.5H9.7v34.7C31.8 237.6 78.4 261 130 261z"/>
                <path fill="#FBBC05" d="M54.5 152.8a79.5 79.5 0 0 1 0-47.6V70.5H9.7a130.6 130.6 0 0 0 0 120.9l44.8-34.6z"/>
                <path fill="#EA4335" d="M130 50.5c19.8 0 37.6 6.8 51.7 20.1l38.7-38.7C196.8 11 166.4 0 130 0 78.4 0 31.8 23.4 9.7 70.5l44.8 34.7C65.1 74.4 94.9 50.5 130 50.5z"/>
              </svg>`}
            />
            <Text
              style={{
                fontSize: 16,
                color: "white",
                fontWeight: "600",
                marginLeft: 8,
              }}
            >
              Sign in with Google
            </Text>
          </View>
        </BlurView>
      </Pressable>
    </View>
  );
}
