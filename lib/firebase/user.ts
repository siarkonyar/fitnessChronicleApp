import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import { z } from "zod";
import { UserSettingsSchema } from "../../types/types";

type UserSettings = z.infer<typeof UserSettingsSchema>;

const GetCurrentUserId = () => {
  const user = auth().currentUser;
  if (!user) throw new Error("User not authenticated");
  return user.uid;
};

export const getUserSettings = async () => {
  const userId = GetCurrentUserId();

  if (!userId) throw new Error("User not authenticated");

  const userRef = firestore().collection("users").doc(userId);
  const doc = await userRef.get();
  const parsedSettings = UserSettingsSchema.safeParse(doc.data());

  if (parsedSettings.success) {
    return parsedSettings.data;
  }

  const defaultSettings: UserSettings = {
    measure: "kg",
  };

  await userRef.set(defaultSettings, { merge: true });
  return defaultSettings;
};
