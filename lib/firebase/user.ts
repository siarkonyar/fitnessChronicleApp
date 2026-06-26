import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import { z } from "zod";
import { UserProfileSchema, UserSettingsSchema } from "../../types/types";

type UserSettings = z.infer<typeof UserSettingsSchema>;
type UserProfile = z.infer<typeof UserProfileSchema>;

const getCurrentUserId = () => {
  const user = auth().currentUser;
  if (!user) throw new Error("User not authenticated");
  return user.uid;
};

export const getUserSettings = async () => {
  const userId = getCurrentUserId();

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

export const updateUserSettings = async (
  updates: Partial<UserSettings>,
): Promise<void> => {
  const userId = getCurrentUserId();

  const sanitized: Record<string, unknown> = {};
  if (updates.measure !== undefined) sanitized.measure = updates.measure;
  if (updates.activeProgramId !== undefined)
    sanitized.activeProgramId = updates.activeProgramId;
  if (updates.activeProgramDay !== undefined)
    sanitized.activeProgramDay = updates.activeProgramDay;
  if (updates.activeProgramDayDate !== undefined)
    sanitized.activeProgramDayDate = updates.activeProgramDayDate;

  await firestore().collection("users").doc(userId).set(sanitized, { merge: true });
};

export const getUserProfile = async (): Promise<UserProfile> => {
  const userId = getCurrentUserId();

  const doc = await firestore().collection("users").doc(userId).get();
  const parsed = UserProfileSchema.safeParse(doc.data());

  if (parsed.success) {
    return parsed.data;
  }

  return {};
};

export const updateUserProfile = async (
  updates: UserProfile,
): Promise<void> => {
  const userId = getCurrentUserId();

  const sanitized: Record<string, unknown> = {};
  if (updates.name !== undefined) sanitized.name = updates.name;
  if (updates.birthday !== undefined) sanitized.birthday = updates.birthday;
  if (updates.gender !== undefined) sanitized.gender = updates.gender;

  const promises: Promise<unknown>[] = [
    firestore().collection("users").doc(userId).set(sanitized, { merge: true }),
  ];

  if (updates.name !== undefined) {
    promises.push(
      auth().currentUser!.updateProfile({ displayName: updates.name || null }),
    );
  }

  await Promise.all(promises);
};
