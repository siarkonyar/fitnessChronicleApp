import { WorkoutTemplateSchema } from "@/types/types";
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import { z } from "zod";

const GetCurrentUserId = () => {
  const user = auth().currentUser;
  if (!user) throw new Error("User not authenticated");
  return user.uid;
};

type WorkoutTemplate = z.infer<typeof WorkoutTemplateSchema>;

export const addProgram = async (name: string, workouts: WorkoutTemplate[]) => {
  const userId = GetCurrentUserId();
  if (!userId) throw new Error("User not authenticated");

  const exerciseLogRef = firestore()
    .collection("users")
    .doc(userId)
    .collection("programLogs");

  const newLogRef = await exerciseLogRef.add({
    ...workouts,
    createdAt: firestore.FieldValue.serverTimestamp(),
  });

  return newLogRef.id;
};

export const deleteProgram = async (id: string) => {
  const userId = GetCurrentUserId();
  if (!userId) throw new Error("User not authenticated");

  const doc = firestore()
    .collection("users")
    .doc(userId)
    .collection("programLogs")
    .doc(id);

  const progDoc = await doc.get();

  if (!progDoc.exists) {
    throw new Error("Fitness log not found.");
  }

  return doc.delete();
};
