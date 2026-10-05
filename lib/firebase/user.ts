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

const DEFAULT_MEASURE: UserSettings["measure"] = "kg";

/**
 * Every setting that validates on its own, minus the ones that do not.
 *
 * Read field by field rather than all-or-nothing: one corrupt optional value
 * (say a negative activeProgramDay) used to fail the whole parse, and the
 * fallback then overwrote a perfectly good "lbs" with "kg" — without
 * converting the stored weights, which were then shown in the wrong unit.
 */
const readValidSettings = (data: Record<string, unknown>): Partial<UserSettings> =>
  Object.fromEntries(
    Object.entries(UserSettingsSchema.shape).flatMap(([key, schema]) => {
      const parsed = schema.safeParse(data[key]);
      return parsed.success && parsed.data !== undefined ? [[key, parsed.data]] : [];
    }),
  );

export const getUserSettings = async (): Promise<UserSettings> => {
  const userId = getCurrentUserId();

  const userRef = firestore().collection("users").doc(userId);
  const doc = await userRef.get();
  const { measure, ...rest } = readValidSettings(doc.data() ?? {});

  if (measure) {
    return { measure, ...rest };
  }

  // Only the unit is required. Write just that, so nothing else is touched.
  await userRef.set({ measure: DEFAULT_MEASURE }, { merge: true });
  return { measure: DEFAULT_MEASURE, ...rest };
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
  // Writing either of these fields is what fires the server-side consent
  // trigger, which appends the immutable record to the top-level
  // consentEvents collection.
  if (updates.analyticsConsent !== undefined)
    sanitized.analyticsConsent = updates.analyticsConsent;

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
