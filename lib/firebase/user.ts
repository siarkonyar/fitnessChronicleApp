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

export const getUserSettings = async (measure: UserSettings) => {
  const userId = GetCurrentUserId();

  if (!userId) throw new Error("User not authenticated");

  const doc = await firestore().collection("users").doc(userId).get();
  return doc.data() as UserSettings | undefined;
};
