import {
  DaySchema,
  ExerciseLogWithIdSchema,
  LabelSchema,
  LabelWithIdSchema,
} from "@/types/types";
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import { z } from "zod";
import { findMostRecentSessionDate, getTodayString } from "../dateUtils";

const GetCurrentUserId = () => {
  const user = auth().currentUser;
  if (!user) throw new Error("User not authenticated");
  return user.uid;
};

type Label = z.infer<typeof LabelSchema>;
type Day = z.infer<typeof DaySchema>;
const MonthDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "Date must be in YYYY-MM format");

export const addLabel = async (label: Label) => {
  const userId = GetCurrentUserId();
  if (!userId) throw new Error("User not authenticated");

  const newLogRef = firestore()
    .collection("users")
    .doc(userId)
    .collection("labels")
    .doc();
  await newLogRef.set({
    ...label,
    createdAt: firestore.FieldValue.serverTimestamp(),
  });
};

export const getLabelById = async (id: string) => {
  const userId = GetCurrentUserId();
  if (!userId) throw new Error("User not authenticated");

  const doc = await firestore()
    .collection("users")
    .doc(userId)
    .collection("labels")
    .doc(id)
    .get();

  if (!doc.exists) {
    throw new Error("Label not found.");
  }

  return LabelWithIdSchema.parse({
    id: doc.id,
    ...doc.data(),
  });
};

export const getAllLabels = async () => {
  const userId = GetCurrentUserId();
  if (!userId) throw new Error("User not authenticated");

  const snapshot = await firestore()
    .collection("users")
    .doc(userId)
    .collection("labels")
    .orderBy("createdAt", "desc")
    .get();

  const labels = snapshot.docs.map((doc) => {
    return LabelWithIdSchema.parse({
      id: doc.id,
      ...doc.data(),
    });
  });

  return labels;
};

export const getAllLabelsFromMonth = async (date: string) => {
  const userId = GetCurrentUserId();
  if (!userId) throw new Error("User not authenticated");

  const validatedDate = MonthDateSchema.parse(date);

  const [year, month] = validatedDate.split("-").map(Number);
  const startDateStr = `${year}-${month.toString().padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDateStr = `${year}-${month.toString().padStart(2, "0")}-${lastDay.toString().padStart(2, "0")}`;

  // Fetch day assignments
  const assignmentsSnapshot = await firestore()
    .collection("users")
    .doc(userId)
    .collection("dayAssignments")
    .where("date", ">=", startDateStr)
    .where("date", "<=", endDateStr)
    .get();

  const assignments = assignmentsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as { date: string; labelId: string }),
  }));

  if (assignments.length === 0) {
    return [];
  }

  // Return { date, label } for each assignment
  return assignments.map((a) => ({
    date: a.date,
    labelId: a.labelId,
  }));
};

export const deleteLabel = async (id: string) => {
  const userId = GetCurrentUserId();
  if (!userId) throw new Error("User not authenticated");

  const logRef = firestore()
    .collection("users")
    .doc(userId)
    .collection("labels")
    .doc(id);
  const logDoc = await logRef.get();

  if (!logDoc.exists) {
    throw new Error("Label not found.");
  }

  const dates: string[] = logDoc.data()?.dates || [];

  if (dates.length > 0) {
    const assignmentSnapshots = await Promise.all(
      dates.map((date) =>
        firestore()
          .collection("users")
          .doc(userId)
          .collection("dayAssignments")
          .where("date", "==", date)
          .where("labelId", "==", id)
          .get(),
      ),
    );

    const deletePromises = assignmentSnapshots.flatMap((snapshot) =>
      snapshot.docs.map((doc) => doc.ref.delete()),
    );

    await Promise.all(deletePromises);
  }

  await logRef.delete();

  return {
    id: id,
    message: "Label deleted successfully!",
  };
};

export const editLabel = async (labelId: string, label: Label) => {
  const userId = GetCurrentUserId();
  if (!userId) throw new Error("User not authenticated");

  const labelRef = firestore()
    .collection("users")
    .doc(userId)
    .collection("labels")
    .doc(labelId);
  const labelDoc = await labelRef.get();

  if (!labelDoc.exists) {
    throw new Error("Label not found.");
  }

  const updateData: Record<string, unknown> = {
    updatedAt: firestore.FieldValue.serverTimestamp(),
  };

  if (label !== undefined) {
    updateData.label = label.label;
    updateData.description = label.description;
  }

  if (label.description !== undefined) {
    updateData.description = label.description;
  }

  await labelRef.update(updateData);

  const updatedDoc = await labelRef.get();

  return LabelWithIdSchema.parse({
    id: updatedDoc.id,
    ...updatedDoc.data(),
  });
};

export const asignLabelToDay = async (day: Day) => {
  const userId = GetCurrentUserId();
  if (!userId) throw new Error("User not authenticated");

  const labelRef = firestore()
    .collection("users")
    .doc(userId)
    .collection("labels")
    .doc(day.labelId);
  const labelDoc = await labelRef.get();

  if (!labelDoc.exists) {
    throw new Error("Label not found.");
  }

  // Check if there's already an assignment for this date
  const existingAssignmentSnapshot = await firestore()
    .collection("users")
    .doc(userId)
    .collection("dayAssignments")
    .where("date", "==", day.date)
    .limit(1)
    .get();

  let assignmentId: string;
  let isUpdate = false;
  let previousLabelId: string | null = null;

  if (!existingAssignmentSnapshot.empty) {
    // Update existing assignment
    const existingDoc = existingAssignmentSnapshot.docs[0];
    assignmentId = existingDoc.id;
    isUpdate = true;
    previousLabelId = existingDoc.data().labelId;

    await existingDoc.ref.update({
      labelId: day.labelId,
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });
  } else {
    // Create new assignment
    const newAssignmentRef = firestore()
      .collection("users")
      .doc(userId)
      .collection("dayAssignments")
      .doc();

    assignmentId = newAssignmentRef.id;

    await newAssignmentRef.set({
      date: day.date,
      labelId: day.labelId,
      createdAt: firestore.FieldValue.serverTimestamp(),
    });
  }

  // Update the label's dates array
  const labelData = labelDoc.data();
  const currentDates = labelData?.dates || [];

  // Add the date if it's not already in the array
  if (!currentDates.includes(day.date)) {
    await labelRef.update({
      dates: firestore.FieldValue.arrayUnion(day.date),
    });
  }

  // If this was an update and the previous label is different, remove the date from the previous label
  if (isUpdate && previousLabelId && previousLabelId !== day.labelId) {
    const previousLabelRef = firestore()
      .collection("users")
      .doc(userId)
      .collection("labels")
      .doc(previousLabelId);
    await previousLabelRef.update({
      dates: firestore.FieldValue.arrayRemove(day.date),
    });
  }

  return {
    id: assignmentId,
    date: day.date,
    labelId: day.labelId,
    message: isUpdate
      ? "Label assignment updated successfully!"
      : "Label assigned to day successfully!",
  };
};

export const getLabelAsignmentByDate = async (date: string) => {
  const userId = GetCurrentUserId();
  if (!userId) throw new Error("User not authenticated");

  // Find the assignment for this date
  const assignmentSnapshot = await firestore()
    .collection("users")
    .doc(userId)
    .collection("dayAssignments")
    .where("date", "==", date)
    .limit(1)
    .get();

  if (assignmentSnapshot.empty) {
    return null; // No assignment found for this date
  }

  const assignmentDoc = assignmentSnapshot.docs[0];
  const assignmentData = assignmentDoc.data();

  if (!assignmentData) {
    return null;
  }

  // Get the full label data
  const labelRef = firestore()
    .collection("users")
    .doc(userId)
    .collection("labels")
    .doc(assignmentData.labelId);
  const labelDoc = await labelRef.get();

  if (!labelDoc.exists) {
    // Label was deleted, automatically delete the assignment
    await assignmentDoc.ref.delete();
    return null; // Return null since the assignment was deleted
  }

  return LabelWithIdSchema.parse({
    id: labelDoc.id,
    ...labelDoc.data(),
  });
};

export const deleteAssignment = async (date: string) => {
  const userId = GetCurrentUserId();
  if (!userId) throw new Error("User not authenticated");

  // Find the assignment for this date
  const assignmentSnapshot = await firestore()
    .collection("users")
    .doc(userId)
    .collection("dayAssignments")
    .where("date", "==", date)
    .limit(1)
    .get();

  if (assignmentSnapshot.empty) {
    throw new Error("No label assignment found for this date.");
  }

  const assignmentDoc = assignmentSnapshot.docs[0];
  const assignmentId = assignmentDoc.id;
  const labelId = assignmentDoc.data().labelId as string | undefined;

  await assignmentDoc.ref.delete();

  if (labelId) {
    const labelRef = firestore()
      .collection("users")
      .doc(userId)
      .collection("labels")
      .doc(labelId);
    await labelRef.update({
      dates: firestore.FieldValue.arrayRemove(date),
    });
  }

  return {
    id: assignmentId,
    date: date,
    message: "Label assignment deleted successfully!",
  };
};

export const getPrevExercisesFromLabel = async (label: Label) => {
  const userId = GetCurrentUserId();
  if (!userId) throw new Error("User not authenticated");

  const dates = label.dates ?? [];
  if (dates.length === 0) {
    return null;
  }

  const today = getTodayString();
  let mostRecentDate = findMostRecentSessionDate(dates, today);

  if (!mostRecentDate) {
    return null;
  }

  while (mostRecentDate) {
    const snapshot = await firestore()
      .collection("users")
      .doc(userId)
      .collection("fitnessLogs")
      .where("date", "==", mostRecentDate)
      .get();

    if (!snapshot.empty) {
      return snapshot.docs.map((doc) =>
        ExerciseLogWithIdSchema.parse({ id: doc.id, ...doc.data() }),
      );
    }

    mostRecentDate = findMostRecentSessionDate(dates, mostRecentDate);
  }
};
