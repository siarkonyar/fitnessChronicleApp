import { getAuth } from "@react-native-firebase/auth";
import { doc, getDoc, getFirestore, setDoc } from "@react-native-firebase/firestore";
import { getISOWeek, getPreviousWeek } from "../dateUtils";

const GetCurrentUserId = () => {
  const user = getAuth().currentUser;
  if (!user) throw new Error("User not authenticated");
  return user.uid;
};

export const updateStreak = async (date: Date) => {
  const userId = GetCurrentUserId();

  if (!userId) throw new Error("User not authenticated");

  const userRef = doc(getFirestore(), "users", userId);
  const userDoc = await getDoc(userRef);

  const { lastLoggedWeek = "" } = userDoc.data() ?? {};

  const currentWeek = getISOWeek(date);
  const prevWeek = getPreviousWeek(currentWeek);

  if (lastLoggedWeek !== currentWeek && lastLoggedWeek !== prevWeek) {
    await setDoc(userRef, { streakWeeks: 0 }, { merge: true });
  } else {
    return;
  }
};

export const getStreak = async (): Promise<number> => {
  const userId = GetCurrentUserId();

  if (!userId) throw new Error("User not authenticated");

  const userDoc = await getDoc(doc(getFirestore(), "users", userId));

  if (!userDoc.exists()) return 0;

  const streakWeeks = userDoc.get("streakWeeks");
  return typeof streakWeeks === "number" ? streakWeeks : 0;
};
