import {
  ExerciseLogSchema,
  ExerciseLogWithIdSchema,
  ExerciseNameListWithIdSchema,
} from "@/types/types";
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import { z } from "zod";
import { getISOWeek, getPreviousWeek } from "../dateUtils";

const GetCurrentUserId = () => {
  const user = auth().currentUser;
  if (!user) throw new Error("User not authenticated");
  return user.uid;
};

type ExerciseLog = z.infer<typeof ExerciseLogSchema>;

export const addExerciseLog = async (exerciseLog: ExerciseLog) => {
  const userId = GetCurrentUserId();
  if (!userId) throw new Error("User not authenticated");
  const exerciseName = exerciseLog.activity;

  const userRef = firestore().collection("users").doc(userId);
  const userDoc = await userRef.get();

  const exerciseLogRef = userRef.collection("fitnessLogs");

  const { streakWeeks = 0, lastLoggedWeek = "" } = userDoc.data() ?? {};

  const newLogRef = await exerciseLogRef.add({
    ...exerciseLog,
    createdAt: firestore.FieldValue.serverTimestamp(),
  });

  const currentWeek = getISOWeek(new Date());

  if (lastLoggedWeek !== currentWeek) {
    const prevWeek = getPreviousWeek(currentWeek);
    const newStreak = lastLoggedWeek === prevWeek ? streakWeeks + 1 : 1;

    await userRef.set(
      { streakWeeks: newStreak, lastLoggedWeek: currentWeek },
      { merge: true },
    );
  }

  const namesRef = firestore()
    .collection("users")
    .doc(userId)
    .collection("exerciseNames");

  const snapshot = await namesRef
    .where("name", "==", exerciseName)
    .limit(1)
    .get();

  if (!snapshot.empty) {
    // Already exists
    console.log("Exercise name already exists");
  } else {
    // Add new exercise name
    const newNameRef = namesRef.doc();
    await newNameRef.set({
      name: exerciseName,
      createdAt: firestore.FieldValue.serverTimestamp(),
    });
    console.log("Exercise name added successfully");
  }

  return newLogRef.id;
};

export const getExerciseLogByDate = async (date: string) => {
  const userId = GetCurrentUserId();
  if (!userId) throw new Error("User not authenticated");

  const exerciseLogRef = firestore()
    .collection("users")
    .doc(userId)
    .collection("fitnessLogs")
    .where("date", "==", date);

  const snapshot = await exerciseLogRef.get();
  return snapshot.docs.map((doc) => {
    return ExerciseLogWithIdSchema.parse({
      id: doc.id,
      ...doc.data(),
    });
  });
};

export const getExerciseLogsByMonth = async (month: string) => {
  const userId = GetCurrentUserId();
  if (!userId) throw new Error("User not authenticated");

  // Get start date of the month: "2025-08-01"
  const startDate = `${month}-01`;

  // Calculate last day of the month:
  const [year, monthNum] = month.split("-").map(Number);
  // JS months are 0-based, so subtract 1, then create a date for the next month day 0 which is last day of the previous month
  const lastDay = new Date(year, monthNum, 0).getDate();

  const endDate = `${month}-${lastDay.toString().padStart(2, "0")}`; // e.g. "2025-08-31"

  const snapshot = await firestore()
    .collection("users")
    .doc(userId)
    .collection("fitnessLogs")
    .where("date", ">=", startDate)
    .where("date", "<=", endDate)
    .get();

  const logs = snapshot.docs.map((doc) => {
    return ExerciseLogWithIdSchema.parse({
      id: doc.id,
      ...doc.data(),
    });
  });

  // Extract unique dates from logs
  const uniqueDatesSet = new Set<string>();
  logs.forEach((log) => {
    if (log.date) uniqueDatesSet.add(log.date);
  });

  const uniqueDates = Array.from(uniqueDatesSet).sort(); // Sort ascending

  return {
    logs,
    uniqueDates,
  };
};

export const getExerciseLogById = async (logId: string) => {
  const userId = GetCurrentUserId();
  if (!userId) throw new Error("User not authenticated");

  const doc = await firestore()
    .collection("users")
    .doc(userId)
    .collection("fitnessLogs")
    .doc(logId)
    .get();

  if (!doc.exists) {
    throw new Error("Fitness log not found.");
  }

  return ExerciseLogWithIdSchema.parse({
    id: doc.id,
    ...doc.data(),
  });
};

export const deleteExerciseLog = async (logId: string) => {
  const userId = GetCurrentUserId();
  if (!userId) throw new Error("User not authenticated");

  const doc = firestore()
    .collection("users")
    .doc(userId)
    .collection("fitnessLogs")
    .doc(logId);

  const logDoc = await doc.get();

  if (!logDoc.exists) {
    throw new Error("Fitness log not found.");
  }

  return doc.delete();
};

export const editExerciseLog = async (logId: string, data: ExerciseLog) => {
  const userId = GetCurrentUserId();
  if (!userId) throw new Error("User not authenticated");

  const log = firestore()
    .collection("users")
    .doc(userId)
    .collection("fitnessLogs")
    .doc(logId);

  const logDoc = await log.get();

  if (!logDoc.exists) {
    throw new Error("Fitness log not found.");
  }
  await log.update(data);
  return {
    id: logId,
    message: "Fitness log updated successfully!",
  };
};

export const getAllExerciseNames = async () => {
  const userId = GetCurrentUserId();
  if (!userId) throw new Error("User not authenticated");

  const snapshot = await firestore()
    .collection("users")
    .doc(userId)
    .collection("exerciseNames")
    .get();

  const names = snapshot.docs.map((doc) => {
    return ExerciseNameListWithIdSchema.parse({
      id: doc.id,
      ...doc.data(),
    });
  });

  return names;
};

export const getLatestExercisesByName = async (name: string) => {
  const userId = GetCurrentUserId();
  if (!userId) throw new Error("User not authenticated");

  const orderedSnapshot = await firestore()
    .collection("users")
    .doc(userId)
    .collection("fitnessLogs")
    .where("activity", "==", name)
    .orderBy("createdAt", "desc")
    .limit(4)
    .get();

  if (orderedSnapshot.empty) {
    return [];
  }

  const logs = orderedSnapshot.docs.map((doc) =>
    ExerciseLogWithIdSchema.parse({
      id: doc.id,
      ...doc.data(),
    }),
  );

  return logs;
};

export const deleteExerciseName = async (nameId: string) => {
  const userId = GetCurrentUserId();
  if (!userId) throw new Error("User not authenticated");

  const snapshot = await firestore()
    .collection("users")
    .doc(userId)
    .collection("exerciseNames")
    .where("name", "==", name)
    .get();

  if (snapshot.empty) {
    throw new Error("Exercise name not found.");
  }

  const batch = firestore().batch();

  const deletedNames: string[] = [];

  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
    deletedNames.push(doc.data.name);
  });

  await batch.commit();

  return {
    deletedNames,
    message: "Exercise name deleted successfully!",
  };
};

export const syncOfflineExercises = async (exerciseLogs: ExerciseLog[]) => {
  const userId = GetCurrentUserId();
  if (!userId) throw new Error("User not authenticated");
  if (exerciseLogs.length === 0) return;

  const orderedSnapshot = await firestore()
    .collection("users")
    .doc(userId)
    .collection("fitnessLogs")
    .orderBy("createdAt", "desc")
    .limit(1)
    .get();

  const lastExercise = orderedSnapshot.docs.map((doc) =>
    ExerciseLogWithIdSchema.parse({
      id: doc.id,
      ...doc.data(),
    }),
  );

  if (
    lastExercise.length > 0 &&
    lastExercise[0].createdAt &&
    new Date().getTime() - lastExercise[0].createdAt.getTime() < 10000
  ) {
    throw new Error("Last offline log made less then 10 seconds ago.");
  }

  const batch = firestore().batch();
  const exerciseNamesToAdd = new Set<string>();

  for (const exerciseLog of exerciseLogs) {
    const newLogRef = firestore()
      .collection("users")
      .doc(userId)
      .collection("fitnessLogs")
      .doc();

    batch.set(newLogRef, {
      ...exerciseLog,
      createdAt: firestore.FieldValue.serverTimestamp(),
    });

    exerciseNamesToAdd.add(exerciseLog.activity);
  }

  await batch.commit();

  const userRef = firestore().collection("users").doc(userId);
  const userDoc = await userRef.get();

  const { streakWeeks = 0, lastLoggedWeek = "" } = userDoc.data() ?? {};

  const currentWeek = getISOWeek(new Date());

  if (lastLoggedWeek !== currentWeek) {
    const prevWeek = getPreviousWeek(currentWeek);
    const newStreak = lastLoggedWeek === prevWeek ? streakWeeks + 1 : 1;

    await userRef.set(
      { streakWeeks: newStreak, lastLoggedWeek: currentWeek },
      { merge: true },
    );
  }

  // Handle exercise names
  const namesRef = firestore()
    .collection("users")
    .doc(userId)
    .collection("exerciseNames");

  const namesBatch = firestore().batch();

  for (const exerciseName of exerciseNamesToAdd) {
    const snapshot = await namesRef
      .where("name", "==", exerciseName)
      .limit(1)
      .get();

    if (snapshot.empty) {
      const newNameRef = namesRef.doc();
      namesBatch.set(newNameRef, {
        name: exerciseName,
        createdAt: firestore.FieldValue.serverTimestamp(),
      });
    }
  }

  await namesBatch.commit();
};
