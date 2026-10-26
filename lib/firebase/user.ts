import { getAuth, updateProfile } from "@react-native-firebase/auth";
import { doc, getDoc, getFirestore, setDoc } from "@react-native-firebase/firestore";
import { z } from "zod";
import { UserProfileSchema, UserSettingsSchema } from "../../types/types";

type UserSettings = z.infer<typeof UserSettingsSchema>;
type UserProfile = z.infer<typeof UserProfileSchema>;

const getCurrentUserId = () => {
  const user = getAuth().currentUser;
  if (!user) throw new Error("User not authenticated");
  return user.uid;
};

const userDoc = (userId: string) => doc(getFirestore(), "users", userId);

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

  const userRef = userDoc(userId);
  const snapshot = await getDoc(userRef);
  const { measure, ...rest } = readValidSettings(snapshot.data() ?? {});

  if (measure) {
    return { measure, ...rest };
  }

  // Only the unit is required. Write just that, so nothing else is touched.
  await setDoc(userRef, { measure: DEFAULT_MEASURE }, { merge: true });
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

  await setDoc(userDoc(userId), sanitized, { merge: true });
};

export const getUserProfile = async (): Promise<UserProfile> => {
  const userId = getCurrentUserId();

  const snapshot = await getDoc(userDoc(userId));
  const parsed = UserProfileSchema.safeParse(snapshot.data());

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
    setDoc(userDoc(userId), sanitized, { merge: true }),
  ];

  if (updates.name !== undefined) {
    promises.push(
      updateProfile(getAuth().currentUser!, {
        displayName: updates.name || null,
      }),
    );
  }

  await Promise.all(promises);
};
