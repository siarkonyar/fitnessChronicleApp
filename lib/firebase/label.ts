import {
  DaySchema,
  ExerciseLogWithIdSchema,
  LabelSchema,
  LabelWithIdSchema,
} from "@/types/types";
import auth from "@react-native-firebase/auth";
import firestore, { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";
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

  if (!doc.exists()) {
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

  if (!logDoc.exists()) {
    throw new Error("Label not found.");
  }

  // Assignments are the references to erase; the label's denormalized dates
  // array may be incomplete after an interrupted assignment write.
  const assignments = await firestore()
    .collection("users")
    .doc(userId)
    .collection("dayAssignments")
    .where("labelId", "==", id)
    .get();
  const batch = firestore().batch();
  assignments.docs.forEach((doc) => batch.delete(doc.ref));
  batch.delete(logRef);
  await batch.commit();

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

  if (!labelDoc.exists()) {
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

// The canonical document id is the calendar date. Legacy random-id documents
// are discovered outside the transaction, then re-read and removed inside it.
// Every current writer also reads the canonical ref, including when absent,
// so Firestore retries competing ownership changes instead of creating twins.
const dateAssignmentRefs = async (
  userRef: FirebaseFirestoreTypes.DocumentReference,
  date: string,
) => {
  const collection = userRef.collection("dayAssignments");
  const legacy = await collection.where("date", "==", date).get();
  return [
    collection.doc(date),
    ...legacy.docs.filter((doc) => doc.id !== date).map((doc) => doc.ref),
  ];
};

const assignmentLabelIds = (docs: FirebaseFirestoreTypes.DocumentSnapshot[]) =>
  [...new Set(docs.flatMap((doc) => {
    const id = doc.data()?.labelId;
    return typeof id === "string" && id.length > 0 ? [id] : [];
  }))];

export const asignLabelToDay = async (day: Day) => {
  const userId = GetCurrentUserId();
  const { date, labelId } = DaySchema.parse(day);
  const userRef = firestore().collection("users").doc(userId);
  const refs = await dateAssignmentRefs(userRef, date);

  return firestore().runTransaction(async (transaction) => {
    const snapshots = await Promise.all(refs.map((ref) => transaction.get(ref)));
    const existing = snapshots.filter((doc) => doc.exists());
    const labelIds = [...new Set([labelId, ...assignmentLabelIds(existing)])];
    const labels = await Promise.all(
      labelIds.map((id) => transaction.get(userRef.collection("labels").doc(id))),
    );
    const target = labels[0];
    if (!target.exists()) throw new Error("Label not found.");

    const isUpdate = existing.length > 0;
    const timestamp = firestore.FieldValue.serverTimestamp();
    transaction.set(refs[0], {
      date,
      labelId,
      createdAt: existing[0]?.data()?.createdAt ?? timestamp,
      ...(isUpdate ? { updatedAt: timestamp } : {}),
    });
    existing.filter((doc) => doc.id !== date).forEach((doc) => transaction.delete(doc.ref));
    transaction.update(target.ref, { dates: firestore.FieldValue.arrayUnion(date) });
    for (const previous of labels.slice(1)) {
      if (previous.exists()) transaction.update(previous.ref, { dates: firestore.FieldValue.arrayRemove(date) });
    }

    return {
      id: date,
      date,
      labelId,
      message: isUpdate
        ? "Label assignment updated successfully!"
        : "Label assigned to day successfully!",
    };
  });
};

export const getLabelAsignmentByDate = async (date: string) => {
  const userId = GetCurrentUserId();
  const validatedDate = DaySchema.shape.date.parse(date);
  const userRef = firestore().collection("users").doc(userId);
  const collection = userRef.collection("dayAssignments");
  const canonical = await collection.doc(validatedDate).get();
  const assignment = canonical.exists()
    ? canonical
    : (await collection.where("date", "==", validatedDate).limit(1).get()).docs[0];
  if (!assignment) return null;
  const labelId = assignment.data()?.labelId;
  if (typeof labelId === "string" && labelId) {
    const label = await userRef.collection("labels").doc(labelId).get();
    if (label.exists()) return LabelWithIdSchema.parse({ id: label.id, ...label.data() });
  }

  // Recheck the orphan inside a transaction so cleanup cannot erase a date
  // that another writer reassigned after our initial read.
  return firestore().runTransaction(async (transaction) => {
    const current = await transaction.get(assignment.ref);
    if (!current.exists()) return null;
    const currentLabelId = current.data()?.labelId;
    if (typeof currentLabelId !== "string" || !currentLabelId) {
      transaction.delete(current.ref);
      return null;
    }
    const label = await transaction.get(userRef.collection("labels").doc(currentLabelId));
    if (!label.exists()) {
      transaction.delete(current.ref);
      return null;
    }
    return LabelWithIdSchema.parse({ id: label.id, ...label.data() });
  });
};

export const deleteAssignment = async (date: string) => {
  const userId = GetCurrentUserId();
  const validatedDate = DaySchema.shape.date.parse(date);
  const userRef = firestore().collection("users").doc(userId);
  const refs = await dateAssignmentRefs(userRef, validatedDate);

  return firestore().runTransaction(async (transaction) => {
    const snapshots = await Promise.all(refs.map((ref) => transaction.get(ref)));
    const existing = snapshots.filter((doc) => doc.exists());
    if (!existing.length) throw new Error("No label assignment found for this date.");
    const labels = await Promise.all(
      assignmentLabelIds(existing).map((id) =>
        transaction.get(userRef.collection("labels").doc(id)),
      ),
    );
    existing.forEach((doc) => transaction.delete(doc.ref));
    for (const label of labels) {
      if (label.exists()) transaction.update(label.ref, { dates: firestore.FieldValue.arrayRemove(validatedDate) });
    }
    return {
      id: existing[0].id,
      date: validatedDate,
      message: "Label assignment deleted successfully!",
    };
  });
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
