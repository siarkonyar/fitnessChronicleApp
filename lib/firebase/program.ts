import {
  ProgramDaySchema,
  ProgramSchema,
  ProgramWithIdSchema,
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
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "@react-native-firebase/firestore";
import { z } from "zod";
import type { QueryResult } from "./firestoreTypes";

const getCurrentUserId = () => {
  const user = getAuth().currentUser;
  if (!user) throw new Error("User not authenticated");
  return user.uid;
};

type Program = z.infer<typeof ProgramSchema>;
type ProgramDay = z.infer<typeof ProgramDaySchema>;
type ProgramWithId = z.infer<typeof ProgramWithIdSchema>;

const programsCollection = (userId: string) =>
  collection(getFirestore(), "users", userId, "programs");

const programDoc = (userId: string, id: string) =>
  doc(getFirestore(), "users", userId, "programs", id);

export const addProgram = async (
  name: string,
  days: ProgramDay[],
): Promise<string> => {
  const userId = getCurrentUserId();

  const ref = await addDoc(programsCollection(userId), {
    name,
    days,
    createdAt: serverTimestamp(),
  });

  return ref.id;
};

export const getPrograms = async (): Promise<ProgramWithId[]> => {
  const userId = getCurrentUserId();

  const snapshot: QueryResult = await getDocs(
    query(programsCollection(userId), orderBy("createdAt", "desc")),
  );

  return snapshot.docs.map((entry) =>
    ProgramWithIdSchema.parse({ id: entry.id, ...entry.data() }),
  );
};

export const getProgram = async (id: string): Promise<ProgramWithId> => {
  const userId = getCurrentUserId();

  const snapshot = await getDoc(programDoc(userId, id));

  if (!snapshot.exists()) throw new Error("Program not found.");

  return ProgramWithIdSchema.parse({ id: snapshot.id, ...snapshot.data() });
};

export const updateProgram = async (
  id: string,
  updates: Partial<Program>,
): Promise<void> => {
  const userId = getCurrentUserId();

  await updateDoc(programDoc(userId, id), updates);
};

export const deleteProgram = async (id: string): Promise<void> => {
  const userId = getCurrentUserId();

  const ref = programDoc(userId, id);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) throw new Error("Program not found.");

  await deleteDoc(ref);
};
