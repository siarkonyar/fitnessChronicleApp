import auth from "@react-native-firebase/auth";
import firestore, { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";
import { z } from "zod";
import { WeightMeasureSchema, WeightWithIdSchema } from "../../types/types";
import { getTodayString } from "../dateUtils";

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

const readWeights = async (
  userRef: FirebaseFirestoreTypes.DocumentReference,
  query: FirebaseFirestoreTypes.Query,
): Promise<WeightWithId[]> => {
  const user = await userRef.get();
  const measure = readMeasure(user.data()?.measure);
  const snapshot = await query.get();
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    const parsed = WeightWithIdSchema.parse({ id: doc.id, ...data });
    return {
      ...parsed,
      weight: convertWeightValue(parsed.weight, readMeasure(data.measure ?? measure), measure),
    };
  });
};

const GetCurrentUserId = () => {
  const user = auth().currentUser;
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

  const weighRef = firestore()
    .collection("users")
    .doc(userId)
    .collection("weightLogs");

  await weighRef
    .where("createdAt", ">=", firestore.Timestamp.fromDate(startOfDay))
    .where("createdAt", "<", firestore.Timestamp.fromDate(startOfNextDay))
    .limit(1)
    .get();

  const userRef = firestore().collection("users").doc(userId);
  const logRef = weighRef.doc();
  const date = getTodayString();
  await firestore().runTransaction(async (transaction) => {
    const user = await transaction.get(userRef);
    transaction.set(logRef, {
      weight: normalizedWeight,
      measure: readMeasure(user.data()?.measure),
      date,
      createdAt: firestore.FieldValue.serverTimestamp(),
    });
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

  if (!weightDoc.exists()) {
    throw new Error("Weight log not found.");
  }

  return doc.delete();
};

export const getWeightMeasure = async (measure: WeightMeasure) => {
  const userId = GetCurrentUserId();

  if (!userId) throw new Error("User not authenticated");

  const doc = await firestore().collection("users").doc(userId).get();
  return doc.data()?.measure as WeightMeasure | undefined;
};

export const updateMeasure = async (measure: WeightMeasure) => {
  const userId = GetCurrentUserId();

  if (!userId) throw new Error("User not authenticated");

  const userRef = firestore().collection("users").doc(userId);
  const logsSnapshot = await userRef.collection("weightLogs").get();

  // Each converted value carries its own unit in the same atomic write.
  // Interrupted migrations remain readable in the selected unit, and retries
  // convert from the entry's unit rather than converting it twice.
  for (let offset = 0; offset < logsSnapshot.docs.length; offset += 450) {
    const refs = logsSnapshot.docs.slice(offset, offset + 450).map((doc) => doc.ref);
    await firestore().runTransaction(async (transaction) => {
      const user = await transaction.get(userRef);
      const currentMeasure = readMeasure(user.data()?.measure);
      const logs = await Promise.all(refs.map((ref) => transaction.get(ref)));
      for (const doc of logs) {
        const data = doc.data();
        if (!doc.exists() || typeof data?.weight !== "number") continue;
        const from = readMeasure(data.measure ?? currentMeasure);
        // Tag legacy values even when no conversion is necessary.
        if (from === measure && data.measure !== undefined) continue;
        transaction.update(doc.ref, {
          weight: convertWeightValue(data.weight, from, measure),
          measure,
        });
      }
    });
  }

  await userRef.set(
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

  const userRef = firestore().collection("users").doc(userId);
  return readWeights(userRef, userRef.collection("weightLogs"));
};

export const getWeightByDate = async (
  date: string,
): Promise<WeightWithId[]> => {
  const userId = GetCurrentUserId();

  if (!userId) throw new Error("User not authenticated");

  const userRef = firestore().collection("users").doc(userId);
  return readWeights(userRef, userRef.collection("weightLogs").where("date", "==", date));
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
