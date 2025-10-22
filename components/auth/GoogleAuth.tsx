import { auth, db } from "@/lib/firebase";
import * as Google from "expo-auth-session/providers/google";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  User,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";

export default function GoogleAuth() {
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID!,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID!,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID!,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID!,
    scopes: ["profile", "email"],
  });
  useEffect(() => {
    if (response?.type === "success" && response.authentication?.idToken) {
      const cred = GoogleAuthProvider.credential(
        response.authentication.idToken,
        response.authentication.accessToken ?? undefined
      );
      signInWithCredential(auth, cred).catch(console.warn);
    }
  }, [response]);

  useEffect(() => {
    const sub = onAuthStateChanged(auth, async (user: User | null) => {
      if (user) {
        // Write a doc to Firestore to verify access
        await setDoc(
          doc(db, "users", user.uid),
          { email: user.email, lastLogin: serverTimestamp() },
          { merge: true }
        );
        console.log("Signed in and wrote to Firestore:", user.uid);
      }
    });
    return () => sub();
  }, []);

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
      }}
    >
      <Pressable disabled={!request} onPress={() => promptAsync()}>
        <Text style={{ fontSize: 18 }}>Sign in with Google</Text>
      </Pressable>
    </View>
  );
}
