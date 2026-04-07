import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import { z } from "zod";
import { WeightMeasureSchema, WeightWithIdSchema } from "../../types/types";
import { getTodayString } from "../dateUtils";

type WeightWithId = z.infer<typeof WeightWithIdSchema>;
type WeightMeasure = z.infer<typeof WeightMeasureSchema>;

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
    .collection("weightLogs");

  await weighRef
    .where("createdAt", ">=", firestore.Timestamp.fromDate(startOfDay))
    .where("createdAt", "<", firestore.Timestamp.fromDate(startOfNextDay))
    .limit(1)
    .get();

  await weighRef.add({
    weight,
    date: getTodayString(),
    createdAt: firestore.FieldValue.serverTimestamp(),
  });
};

export const deleteWeightLogById = async (id: string) => {
  const userId = GetCurrentUserId();
  if (!userId) throw new Error("User not authenticated");

  const doc = firestore()
    .collection("users")
    .doc(userId)
    .collection("weightLogs")
    .doc(id);

  const weightDoc = await doc.get();

  if (!weightDoc.exists) {
    throw new Error("Weight log not found.");
  }

  return doc.delete();
};

export const updateWeightMeasure = async (measure: WeightMeasure) => {
  const userId = GetCurrentUserId();

  if (!userId) throw new Error("User not authenticated");

  await firestore().collection("users").doc(userId).set(
    {
      measure,
    },
    { merge: true },
  );
};

export const updateMasure = updateWeightMeasure;

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
    .collection("weightLogs");

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

export const getWeights = async (): Promise<WeightWithId[]> => {
  const userId = GetCurrentUserId();

  if (!userId) throw new Error("User not authenticated");

  const weighRef = firestore()
    .collection("users")
    .doc(userId)
    .collection("weightLogs");

  const snapshot = await weighRef.get();
  return snapshot.docs.map((doc) => {
    return WeightWithIdSchema.parse({
      id: doc.id,
      ...doc.data(),
    });
  });
};

export const getWeightByDate = async (
  date: string,
): Promise<WeightWithId[]> => {
  const userId = GetCurrentUserId();

  if (!userId) throw new Error("User not authenticated");

  const weighRef = firestore()
    .collection("users")
    .doc(userId)
    .collection("weightLogs")
    .where("date", "==", date);

  const snapshot = await weighRef.get();
  return snapshot.docs.map((doc) => {
    return WeightWithIdSchema.parse({
      id: doc.id,
      ...doc.data(),
    });
  });
};

/* export const getWeightsByYear = async (year: string): Promise<Weight[]> => {
  const userId = GetCurrentUserId();

  if (!userId) throw new Error("User not authenticated");

  if (!/^\d{4}$/.test(year)) {
    throw new Error("Year must be in YYYY format");
  }

  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

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
}; */
