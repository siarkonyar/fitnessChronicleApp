import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import { getPreviousWeek } from "../dateUtils";

const GetCurrentUserId = () => {
  const user = auth().currentUser;
  if (!user) throw new Error("User not authenticated");
  return user.uid;
};

export const updateStreak = async (currentWeek: string) => {
  const userId = GetCurrentUserId();
  const userRef = firestore().collection("users").doc(userId);
  const userDoc = await userRef.get();

  const { streakWeeks = 0, lastLoggedWeek = "" } = userDoc.data() ?? {};

  if (lastLoggedWeek === currentWeek) return;

  const prevWeek = getPreviousWeek(currentWeek);
  const newStreak = lastLoggedWeek === prevWeek ? streakWeeks + 1 : 1;

  await userRef.set(
    { streakWeeks: newStreak, lastLoggedWeek: currentWeek },
    { merge: true },
  );
};

export const resetStreak = async () => {
  const userId = GetCurrentUserId();
  if (!userId) throw new Error("User not authenticated");

  const newLogRef = firestore()
    .collection("users")
    .doc(userId)
    .collection("labels")
    .doc();
  await newLogRef.set({
    ...label,
    createdAt: firestore.FieldValue.serverTimestamp(),
  });
};
