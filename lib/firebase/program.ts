import {
  ProgramDaySchema,
  ProgramSchema,
  ProgramWithIdSchema,
} from "@/types/types";
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import { z } from "zod";

const getCurrentUserId = () => {
  const user = auth().currentUser;
  if (!user) throw new Error("User not authenticated");
  return user.uid;
};

type Program = z.infer<typeof ProgramSchema>;
type ProgramDay = z.infer<typeof ProgramDaySchema>;
type ProgramWithId = z.infer<typeof ProgramWithIdSchema>;

const programsCollection = (userId: string) =>
  firestore().collection("users").doc(userId).collection("programs");

export const addProgram = async (
  name: string,
  days: ProgramDay[],
): Promise<string> => {
  const userId = getCurrentUserId();

  const ref = await programsCollection(userId).add({
    name,
    days,
    createdAt: firestore.FieldValue.serverTimestamp(),
  });

  return ref.id;
};

export const getPrograms = async (): Promise<ProgramWithId[]> => {
  const userId = getCurrentUserId();

  const snapshot = await programsCollection(userId).get();

  return snapshot.docs.map((doc) =>
    ProgramWithIdSchema.parse({ id: doc.id, ...doc.data() }),
  );
};

export const getProgram = async (id: string): Promise<ProgramWithId> => {
  const userId = getCurrentUserId();

  const doc = await programsCollection(userId).doc(id).get();

  if (!doc.exists) throw new Error("Program not found.");

  return ProgramWithIdSchema.parse({ id: doc.id, ...doc.data() });
};

export const updateProgram = async (
  id: string,
  updates: Partial<Program>,
): Promise<void> => {
  const userId = getCurrentUserId();

  await programsCollection(userId).doc(id).update(updates);
};

export const deleteProgram = async (id: string): Promise<void> => {
  const userId = getCurrentUserId();

  const ref = programsCollection(userId).doc(id);
  const doc = await ref.get();

  if (!doc.exists) throw new Error("Program not found.");

  await ref.delete();
};
