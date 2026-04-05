import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import { z } from "zod";
import { WeightSchema, WeightWithIdSchema } from "../../types/types";

type Weight = z.infer<typeof WeightSchema>;

const GetCurrentUserId = () => {
  const user = auth().currentUser;
  if (!user) throw new Error("User not authenticated");
  return user.uid;
};

export const addWeightLog = async (weight: number) => {
  const userId = GetCurrentUserId();

  if (!userId) throw new Error("User not authenticated");

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const startOfNextDay = new Date(startOfDay);
  startOfNextDay.setDate(startOfNextDay.getDate() + 1);

  const weighRef = firestore()
    .collection("users")
    .doc(userId)
    .collection("exerciseNames");

  const existingLogSnapshot = await weighRef
    .where("createdAt", ">=", firestore.Timestamp.fromDate(startOfDay))
    .where("createdAt", "<", firestore.Timestamp.fromDate(startOfNextDay))
    .limit(1)
    .get();

  if (!existingLogSnapshot.empty) {
    throw new Error("A weight log already exists for today");
  }

  await weighRef.add({
    weight,
    createdAt: firestore.FieldValue.serverTimestamp(),
  });
};

export const getIfTodayLogged = async (): Promise<boolean> => {
  const userId = GetCurrentUserId();

  if (!userId) throw new Error("User not authenticated");

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const startOfNextDay = new Date(startOfDay);
  startOfNextDay.setDate(startOfNextDay.getDate() + 1);

  const weighRef = firestore()
    .collection("users")
    .doc(userId)
    .collection("exerciseNames");

  const existingLogSnapshot = await weighRef
    .where("createdAt", ">=", firestore.Timestamp.fromDate(startOfDay))
    .where("createdAt", "<", firestore.Timestamp.fromDate(startOfNextDay))
    .limit(1)
    .get();

  if (!existingLogSnapshot.empty) {
    return true;
  } else {
    return false;
  }
};

export const getWeights = async (): Promise<Weight[]> => {
  const userId = GetCurrentUserId();

  if (!userId) throw new Error("User not authenticated");

  const weighRef = firestore()
    .collection("users")
    .doc(userId)
    .collection("exerciseNames");

  const snapshot = await weighRef.get();
  return snapshot.docs.map((doc) => {
    return WeightWithIdSchema.parse({
      id: doc.id,
      ...doc.data(),
    });
  });
};

export const getWeightByDate = async (date: string): Promise<Weight[]> => {
  const userId = GetCurrentUserId();

  if (!userId) throw new Error("User not authenticated");

  const weighRef = firestore()
    .collection("users")
    .doc(userId)
    .collection("exerciseNames")
    .where("date", "==", date);

  const snapshot = await weighRef.get();
  return snapshot.docs.map((doc) => {
    return WeightWithIdSchema.parse({
      id: doc.id,
      ...doc.data(),
    });
  });
};

export const getWeightByMonth = async (month: string): Promise<Weight[]> => {
  const userId = GetCurrentUserId();

  if (!userId) throw new Error("User not authenticated");

  const startDate = `${month}-01`;

  const [year, monthNum] = month.split("-").map(Number);
  const lastDay = new Date(year, monthNum, 0).getDate();

  const endDate = `${month}-${lastDay.toString().padStart(2, "0")}`;

  const snapshot = await firestore()
    .collection("users")
    .doc(userId)
    .collection("fitnessLogs")
    .where("date", ">=", startDate)
    .where("date", "<=", endDate)
    .get();

  return snapshot.docs.map((doc) => {
    return WeightWithIdSchema.parse({
      id: doc.id,
      ...doc.data(),
    });
  });
};
