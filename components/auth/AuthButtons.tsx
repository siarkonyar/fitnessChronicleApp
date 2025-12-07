import { Colors } from "@/constants/Colors";
import { appleAuth } from "@invertase/react-native-apple-authentication";
import {
  AppleAuthProvider,
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
} from "@react-native-firebase/auth";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { BlurView } from "expo-blur";
import { useState } from "react";
import { Platform, Pressable, Text, useColorScheme, View } from "react-native";
import { SvgXml } from "react-native-svg";

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID!,
});

export default function AuthButtons() {
  const [loading, setLoading] = useState(false);
  const theme = useColorScheme() ?? "light";
  // Keep some transparency so the blur is visible. 0x40 ≈ 25% alpha.
  const highlightWithAlpha = `${Colors[theme].highlight}40`;
  const [appleError, setAppleError] = useState<any | null>(null);

  async function onGoogleButtonPress() {
    try {
      setLoading(true);
      // Check if your device supports Google Play
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });
      // Get the users ID token
      const signInResult = await GoogleSignin.signIn();

      // Get the ID token from the sign-in result (v13+ format)
      const idToken = signInResult.data?.idToken;
      if (!idToken) {
        throw new Error("No ID token found");
      }

      // Create a Google credential with the token
      const googleCredential = GoogleAuthProvider.credential(idToken);

      // Sign-in the user with the credential
      const userCredential = await signInWithCredential(
        getAuth(),
        googleCredential
      );

      return userCredential;
    } catch (error) {
      console.error("Google Sign-In Error:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  }

  async function onAppleButtonPress() {
    try {
      // Start the sign-in request
      const appleAuthRequestResponse = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        // As per the FAQ of react-native-apple-authentication, the name should come first in the following array.
        // See: https://github.com/invertase/react-native-apple-authentication#faqs
        requestedScopes: [appleAuth.Scope.FULL_NAME, appleAuth.Scope.EMAIL],
      });

      // Ensure Apple returned a user identityToken
      if (!appleAuthRequestResponse.identityToken) {
        throw new Error("Apple Sign-In failed - no identify token returned");
      }

      // Create a Firebase credential from the response
      const { identityToken, nonce } = appleAuthRequestResponse;
      const appleCredential = AppleAuthProvider.credential(
        identityToken,
        nonce
      );

      setLoading(false);

      // Sign the user in with the credential
      return signInWithCredential(getAuth(), appleCredential);
    } catch (error) {
      console.error("Apple Sign-In Error:", error);
      console.error("Error Code:", (error as any).code);
      console.error("Error Message:", (error as any).message);
      setAppleError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className="mt-4 items-center flex-col justify-center">
      {Platform.OS === "ios" && (
        <Pressable
          disabled={loading}
          onPress={() => {
            setLoading(true);
            onAppleButtonPress();
          }}
          style={{ opacity: loading ? 0.7 : 1 }}
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
        disabled={loading}
        onPress={() => {
          onGoogleButtonPress();
        }}
        style={{ opacity: loading ? 0.7 : 1 }}
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
