import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import { getISOWeek, getPreviousWeek } from "../dateUtils";

const GetCurrentUserId = () => {
  const user = auth().currentUser;
  if (!user) throw new Error("User not authenticated");
  return user.uid;
};

export const updateStreak = async (date: Date) => {
  const userId = GetCurrentUserId();

  if (!userId) throw new Error("User not authenticated");

  const userRef = firestore().collection("users").doc(userId);
  const userDoc = await userRef.get();

  const { lastLoggedWeek = "" } = userDoc.data() ?? {};

  const currentWeek = getISOWeek(date);
  const prevWeek = getPreviousWeek(currentWeek);

  if (lastLoggedWeek !== currentWeek && lastLoggedWeek !== prevWeek) {
    await userRef.set({ streakWeeks: 0 }, { merge: true });
  } else {
    return;
  }
};

export const getStreak = async (): Promise<number> => {
  const userId = GetCurrentUserId();

  if (!userId) throw new Error("User not authenticated");

  const userRef = firestore().collection("users").doc(userId);
  const userDoc = await userRef.get();

  if (!userDoc.exists) return 0;

  const streakWeeks = userDoc.get("streakWeeks");
  return typeof streakWeeks === "number" ? streakWeeks : 0;
};
