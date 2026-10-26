import {
  ExerciseLogSchema,
  ExerciseLogWithIdSchema,
  ExerciseNameListWithIdSchema,
} from "@/types/types";
import { getAuth } from "@react-native-firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "@react-native-firebase/firestore";
import { z } from "zod";
import { getISOWeek, getPreviousWeek } from "../dateUtils";
import type { QueryResult } from "./firestoreTypes";

const GetCurrentUserId = () => {
  const user = getAuth().currentUser;
  if (!user) throw new Error("User not authenticated");
  return user.uid;
};

type ExerciseLog = z.infer<typeof ExerciseLogSchema>;

const userDocument = (userId: string) => doc(getFirestore(), "users", userId);

const fitnessLogs = (userId: string) =>
  collection(getFirestore(), "users", userId, "fitnessLogs");

const fitnessLog = (userId: string, logId: string) =>
  doc(getFirestore(), "users", userId, "fitnessLogs", logId);

const exerciseNames = (userId: string) =>
  collection(getFirestore(), "users", userId, "exerciseNames");

export const addExerciseLog = async (exerciseLog: ExerciseLog) => {
  const userId = GetCurrentUserId();
  if (!userId) throw new Error("User not authenticated");
  const exerciseName = exerciseLog.activity;

  const userRef = userDocument(userId);
  const userDoc = await getDoc(userRef);

  const { streakWeeks = 0, lastLoggedWeek = "" } = userDoc.data() ?? {};

  const newLogRef = await addDoc(fitnessLogs(userId), {
    ...exerciseLog,
    createdAt: serverTimestamp(),
  });

  const currentWeek = getISOWeek(new Date());

  if (lastLoggedWeek !== currentWeek) {
    const prevWeek = getPreviousWeek(currentWeek);
    const newStreak = lastLoggedWeek === prevWeek ? streakWeeks + 1 : 1;

    await setDoc(
      userRef,
      { streakWeeks: newStreak, lastLoggedWeek: currentWeek },
      { merge: true },
    );
  }

  const namesRef = exerciseNames(userId);

  const snapshot: QueryResult = await getDocs(
    query(namesRef, where("name", "==", exerciseName), limit(1)),
  );

  if (!snapshot.empty) {
    // Already exists
    console.log("Exercise name already exists");
  } else {
    // Add new exercise name
    await addDoc(namesRef, {
      name: exerciseName,
      createdAt: serverTimestamp(),
    });
    console.log("Exercise name added successfully");
  }

  return newLogRef.id;
};

export const getExerciseLogByDate = async (date: string) => {
  const userId = GetCurrentUserId();
  if (!userId) throw new Error("User not authenticated");

  const snapshot: QueryResult = await getDocs(
    query(fitnessLogs(userId), where("date", "==", date)),
  );
  return snapshot.docs.map((entry) => {
    return ExerciseLogWithIdSchema.parse({
      id: entry.id,
      ...entry.data(),
    });
  });
};

export const getExerciseLogsByDateRange = async (
  startDate: string,
  endDate: string,
) => {
  const userId = GetCurrentUserId();
  if (!userId) throw new Error("User not authenticated");

  const snapshot: QueryResult = await getDocs(
    query(
      fitnessLogs(userId),
      where("date", ">=", startDate),
      where("date", "<=", endDate),
      limit(200),
    ),
  );

  const logs = snapshot.docs.map((entry) => {
    return ExerciseLogWithIdSchema.parse({
      id: entry.id,
      ...entry.data(),
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

export const getExerciseLogsByMonth = async (month: string) => {
  const userId = GetCurrentUserId();
  if (!userId) throw new Error("User not authenticated");

  const startDate = `${month}-01`;

  const [year, monthNum] = month.split("-").map(Number);
  const lastDay = new Date(year, monthNum, 0).getDate();

  const endDate = `${month}-${lastDay.toString().padStart(2, "0")}`; // e.g. "2025-08-31"

  const snapshot: QueryResult = await getDocs(
    query(
      fitnessLogs(userId),
      where("date", ">=", startDate),
      where("date", "<=", endDate),
    ),
  );

  const logs = snapshot.docs.map((entry) => {
    return ExerciseLogWithIdSchema.parse({
      id: entry.id,
      ...entry.data(),
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

  const snapshot = await getDoc(fitnessLog(userId, logId));

  if (!snapshot.exists()) {
    throw new Error("Fitness log not found.");
  }

  return ExerciseLogWithIdSchema.parse({
    id: snapshot.id,
    ...snapshot.data(),
  });
};

export const deleteExerciseLog = async (logId: string) => {
  const userId = GetCurrentUserId();
  if (!userId) throw new Error("User not authenticated");

  const logRef = fitnessLog(userId, logId);

  const logDoc = await getDoc(logRef);

  if (!logDoc.exists()) {
    throw new Error("Fitness log not found.");
  }

  return deleteDoc(logRef);
};

export const editExerciseLog = async (logId: string, data: ExerciseLog) => {
  const userId = GetCurrentUserId();
  if (!userId) throw new Error("User not authenticated");

  const log = fitnessLog(userId, logId);

  const logDoc = await getDoc(log);

  if (!logDoc.exists()) {
    throw new Error("Fitness log not found.");
  }
  await updateDoc(log, data);
  return {
    id: logId,
    message: "Fitness log updated successfully!",
  };
};

export const getAllExerciseNames = async () => {
  const userId = GetCurrentUserId();
  if (!userId) throw new Error("User not authenticated");

  const snapshot: QueryResult = await getDocs(exerciseNames(userId));

  const names = snapshot.docs.map((entry) => {
    return ExerciseNameListWithIdSchema.parse({
      id: entry.id,
      ...entry.data(),
    });
  });

  return names;
};

export const getLatestExercisesByName = async (name: string) => {
  const userId = GetCurrentUserId();
  if (!userId) throw new Error("User not authenticated");

  const orderedSnapshot: QueryResult = await getDocs(
    query(
      fitnessLogs(userId),
      where("activity", "==", name),
      orderBy("createdAt", "desc"),
      limit(4),
    ),
  );

  if (orderedSnapshot.empty) {
    return [];
  }

  const logs = orderedSnapshot.docs.map((entry) =>
    ExerciseLogWithIdSchema.parse({
      id: entry.id,
      ...entry.data(),
    }),
  );

  return logs;
};

/**
 * Forgets a remembered exercise name, so it stops being suggested.
 *
 * Deletes by the name itself, not a document id: the suggestion list only
 * knows the text. Every duplicate of that exact name goes, and past logs of
 * the exercise are left alone.
 */
export const deleteExerciseName = async (name: string) => {
  const userId = GetCurrentUserId();
  if (!userId) throw new Error("User not authenticated");

  const snapshot: QueryResult = await getDocs(
    query(exerciseNames(userId), where("name", "==", name)),
  );

  if (snapshot.empty) {
    throw new Error("Exercise name not found.");
  }

  const batch = writeBatch(getFirestore());

  const deletedNames: string[] = [];

  snapshot.docs.forEach((entry) => {
    batch.delete(entry.ref);
    deletedNames.push(entry.data().name as string);
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

  const orderedSnapshot: QueryResult = await getDocs(
    query(fitnessLogs(userId), orderBy("createdAt", "desc"), limit(1)),
  );

  const lastExercise = orderedSnapshot.docs.map((entry) =>
    ExerciseLogWithIdSchema.parse({
      id: entry.id,
      ...entry.data(),
    }),
  );

  if (
    lastExercise.length > 0 &&
    lastExercise[0].createdAt &&
    new Date().getTime() - lastExercise[0].createdAt.getTime() < 10000
  ) {
    throw new Error("Last offline log made less then 10 seconds ago.");
  }

  const batch = writeBatch(getFirestore());
  const exerciseNamesToAdd = new Set<string>();

  for (const exerciseLog of exerciseLogs) {
    batch.set(doc(fitnessLogs(userId)), {
      ...exerciseLog,
      createdAt: serverTimestamp(),
    });

    exerciseNamesToAdd.add(exerciseLog.activity);
  }

  await batch.commit();

  const userRef = userDocument(userId);
  const userDoc = await getDoc(userRef);

  const { streakWeeks = 0, lastLoggedWeek = "" } = userDoc.data() ?? {};

  const currentWeek = getISOWeek(new Date());

  if (lastLoggedWeek !== currentWeek) {
    const prevWeek = getPreviousWeek(currentWeek);
    const newStreak = lastLoggedWeek === prevWeek ? streakWeeks + 1 : 1;

    await setDoc(
      userRef,
      { streakWeeks: newStreak, lastLoggedWeek: currentWeek },
      { merge: true },
    );
  }

  // Handle exercise names
  const namesRef = exerciseNames(userId);

  const namesBatch = writeBatch(getFirestore());

  for (const exerciseName of exerciseNamesToAdd) {
    const snapshot: QueryResult = await getDocs(
      query(namesRef, where("name", "==", exerciseName), limit(1)),
    );

    if (snapshot.empty) {
      namesBatch.set(doc(namesRef), {
        name: exerciseName,
        createdAt: serverTimestamp(),
      });
    }
  }

  await namesBatch.commit();
};
