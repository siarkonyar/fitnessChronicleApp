import { getAuth } from "@react-native-firebase/auth";
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
} from "@react-native-firebase/firestore";
import { z } from "zod";
import { WeightMeasureSchema, WeightWithIdSchema } from "../../types/types";
import { getTodayString } from "../dateUtils";
import type { DocRef, QueryRef, QueryResult } from "./firestoreTypes";

type WeightWithId = z.infer<typeof WeightWithIdSchema>;
type WeightMeasure = z.infer<typeof WeightMeasureSchema>;

const KG_TO_LBS = 2.2046226218;

const roundWeight = (value: number) => Math.round(value * 100) / 100;

const convertWeightValue = (
  value: number,
  from: WeightMeasure,
  to: WeightMeasure,
) => {
  if (from === to) return value;

  if (from === "kg" && to === "lbs") {
    return roundWeight(value * KG_TO_LBS);
  }

  return roundWeight(value / KG_TO_LBS);
};

const readMeasure = (value: unknown): WeightMeasure => value === "lbs" ? "lbs" : "kg";

const userDoc = (userId: string) => doc(getFirestore(), "users", userId);

const weightLogs = (userId: string) =>
  collection(getFirestore(), "users", userId, "weightLogs");

const readWeights = async (
  userRef: DocRef,
  weightsQuery: QueryRef,
): Promise<WeightWithId[]> => {
  const user = await getDoc(userRef);
  const measure = readMeasure(user.data()?.measure);
  const snapshot: QueryResult = await getDocs(weightsQuery);
  return snapshot.docs.map((weightDoc) => {
    const data = weightDoc.data();
    const parsed = WeightWithIdSchema.parse({ id: weightDoc.id, ...data });
    return {
      ...parsed,
      weight: convertWeightValue(parsed.weight, readMeasure(data.measure ?? measure), measure),
    };
  });
};

const GetCurrentUserId = () => {
  const user = getAuth().currentUser;
  if (!user) throw new Error("User not authenticated");
  return user.uid;
};

export const addWeightLog = async (weight: number) => {
  const userId = GetCurrentUserId();

  if (!userId) throw new Error("User not authenticated");

  const normalizedWeight = roundWeight(weight);

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const startOfNextDay = new Date(startOfDay);
  startOfNextDay.setDate(startOfNextDay.getDate() + 1);

  const weighRef = weightLogs(userId);

  await getDocs(
    query(
      weighRef,
      where("createdAt", ">=", Timestamp.fromDate(startOfDay)),
      where("createdAt", "<", Timestamp.fromDate(startOfNextDay)),
      limit(1),
    ),
  );

  const userRef = userDoc(userId);
  const logRef = doc(weighRef);
  const date = getTodayString();
  await runTransaction(getFirestore(), async (transaction) => {
    const user = await transaction.get(userRef);
    transaction.set(logRef, {
      weight: normalizedWeight,
      measure: readMeasure(user.data()?.measure),
      date,
      createdAt: serverTimestamp(),
    });
  });
};

export const deleteWeightLogById = async (id: string) => {
  const userId = GetCurrentUserId();
  if (!userId) throw new Error("User not authenticated");

  const weightRef = doc(getFirestore(), "users", userId, "weightLogs", id);

  const weightDoc = await getDoc(weightRef);

  if (!weightDoc.exists()) {
    throw new Error("Weight log not found.");
  }

  return deleteDoc(weightRef);
};

export const getWeightMeasure = async (measure: WeightMeasure) => {
  const userId = GetCurrentUserId();

  if (!userId) throw new Error("User not authenticated");

  const user = await getDoc(userDoc(userId));
  return user.data()?.measure as WeightMeasure | undefined;
};

export const updateMeasure = async (measure: WeightMeasure) => {
  const userId = GetCurrentUserId();

  if (!userId) throw new Error("User not authenticated");

  const userRef = userDoc(userId);
  const logsSnapshot: QueryResult = await getDocs(weightLogs(userId));

  // Each converted value carries its own unit in the same atomic write.
  // Interrupted migrations remain readable in the selected unit, and retries
  // convert from the entry's unit rather than converting it twice.
  for (let offset = 0; offset < logsSnapshot.docs.length; offset += 450) {
    const refs = logsSnapshot.docs
      .slice(offset, offset + 450)
      .map((weightDoc) => weightDoc.ref);
    await runTransaction(getFirestore(), async (transaction) => {
      const user = await transaction.get(userRef);
      const currentMeasure = readMeasure(user.data()?.measure);
      const logs = await Promise.all(refs.map((ref) => transaction.get(ref)));
      for (const log of logs) {
        const data = log.data();
        if (!log.exists() || typeof data?.weight !== "number") continue;
        const from = readMeasure(data.measure ?? currentMeasure);
        // Tag legacy values even when no conversion is necessary.
        if (from === measure && data.measure !== undefined) continue;
        transaction.update(log.ref, {
          weight: convertWeightValue(data.weight, from, measure),
          measure,
        });
      }
    });
  }

  await setDoc(
    userRef,
    {
      measure,
    },
    { merge: true },
  );
};

export const updateMasure = updateMeasure;

export const getIfTodayLogged = async (): Promise<boolean> => {
  const userId = GetCurrentUserId();

  if (!userId) throw new Error("User not authenticated");

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const startOfNextDay = new Date(startOfDay);
  startOfNextDay.setDate(startOfNextDay.getDate() + 1);

  const existingLogSnapshot: QueryResult = await getDocs(
    query(
      weightLogs(userId),
      where("createdAt", ">=", Timestamp.fromDate(startOfDay)),
      where("createdAt", "<", Timestamp.fromDate(startOfNextDay)),
      limit(1),
    ),
  );

  if (!existingLogSnapshot.empty) {
    return true;
  } else {
    return false;
  }
};

export const getWeights = async (): Promise<WeightWithId[]> => {
  const userId = GetCurrentUserId();

  if (!userId) throw new Error("User not authenticated");

  return readWeights(userDoc(userId), query(weightLogs(userId)));
};

export const getWeightByDate = async (
  date: string,
): Promise<WeightWithId[]> => {
  const userId = GetCurrentUserId();

  if (!userId) throw new Error("User not authenticated");

  return readWeights(
    userDoc(userId),
    query(weightLogs(userId), where("date", "==", date)),
  );
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
