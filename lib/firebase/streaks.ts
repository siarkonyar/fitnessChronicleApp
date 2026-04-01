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
  const userRef = firestore().collection("users").doc(userId);
  const userDoc = await userRef.get();

  const { streakWeeks = 0, lastLoggedWeek = "" } = userDoc.data() ?? {};

  const currentWeek = getISOWeek(date);
  const prevWeek = getPreviousWeek(currentWeek);

  if (lastLoggedWeek === currentWeek || lastLoggedWeek === prevWeek) return;

  if (lastLoggedWeek !== currentWeek && lastLoggedWeek !== prevWeek) {
    await userRef.set({ streakWeeks: 0 }, { merge: true });
  }
};
