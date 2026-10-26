import {
  DaySchema,
  ExerciseLogWithIdSchema,
  LabelSchema,
  LabelWithIdSchema,
} from "@/types/types";
import { getAuth } from "@react-native-firebase/auth";
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "@react-native-firebase/firestore";
import { z } from "zod";
import { findMostRecentSessionDate, getTodayString } from "../dateUtils";
import type { DocSnapshot, QueryDoc, QueryResult } from "./firestoreTypes";

const GetCurrentUserId = () => {
  const user = getAuth().currentUser;
  if (!user) throw new Error("User not authenticated");
  return user.uid;
};

type Label = z.infer<typeof LabelSchema>;
type Day = z.infer<typeof DaySchema>;
const MonthDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "Date must be in YYYY-MM format");

const labelsCollection = (userId: string) =>
  collection(getFirestore(), "users", userId, "labels");

const labelDoc = (userId: string, id: string) =>
  doc(getFirestore(), "users", userId, "labels", id);

const assignmentsCollection = (userId: string) =>
  collection(getFirestore(), "users", userId, "dayAssignments");

export const addLabel = async (label: Label) => {
  const userId = GetCurrentUserId();
  if (!userId) throw new Error("User not authenticated");

  await addDoc(labelsCollection(userId), {
    ...label,
    createdAt: serverTimestamp(),
  });
};

export const getLabelById = async (id: string) => {
  const userId = GetCurrentUserId();
  if (!userId) throw new Error("User not authenticated");

  const snapshot = await getDoc(labelDoc(userId, id));

  if (!snapshot.exists()) {
    throw new Error("Label not found.");
  }

  return LabelWithIdSchema.parse({
    id: snapshot.id,
    ...snapshot.data(),
  });
};

export const getAllLabels = async () => {
  const userId = GetCurrentUserId();
  if (!userId) throw new Error("User not authenticated");

  const snapshot: QueryResult = await getDocs(
    query(labelsCollection(userId), orderBy("createdAt", "desc")),
  );

  const labels = snapshot.docs.map((entry) => {
    return LabelWithIdSchema.parse({
      id: entry.id,
      ...entry.data(),
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
  const assignmentsSnapshot: QueryResult = await getDocs(
    query(
      assignmentsCollection(userId),
      where("date", ">=", startDateStr),
      where("date", "<=", endDateStr),
    ),
  );

  const assignments = assignmentsSnapshot.docs.map((entry) => ({
    id: entry.id,
    ...(entry.data() as { date: string; labelId: string }),
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

  const logRef = labelDoc(userId, id);
  const logDoc = await getDoc(logRef);

  if (!logDoc.exists()) {
    throw new Error("Label not found.");
  }

  // Assignments are the references to erase; the label's denormalized dates
  // array may be incomplete after an interrupted assignment write.
  const assignments: QueryResult = await getDocs(
    query(assignmentsCollection(userId), where("labelId", "==", id)),
  );
  const batch = writeBatch(getFirestore());
  assignments.docs.forEach((entry) => batch.delete(entry.ref));
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

  const labelRef = labelDoc(userId, labelId);
  const existing = await getDoc(labelRef);

  if (!existing.exists()) {
    throw new Error("Label not found.");
  }

  const updateData: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (label !== undefined) {
    updateData.label = label.label;
    updateData.description = label.description;
  }

  if (label.description !== undefined) {
    updateData.description = label.description;
  }

  await updateDoc(labelRef, updateData);

  const updatedDoc = await getDoc(labelRef);

  return LabelWithIdSchema.parse({
    id: updatedDoc.id,
    ...updatedDoc.data(),
  });
};

// The canonical document id is the calendar date. Legacy random-id documents
// are discovered outside the transaction, then re-read and removed inside it.
// Every current writer also reads the canonical ref, including when absent,
// so Firestore retries competing ownership changes instead of creating twins.
const dateAssignmentRefs = async (userId: string, date: string) => {
  const legacy: QueryResult = await getDocs(
    query(assignmentsCollection(userId), where("date", "==", date)),
  );
  return [
    doc(getFirestore(), "users", userId, "dayAssignments", date),
    ...legacy.docs.filter((entry) => entry.id !== date).map((entry) => entry.ref),
  ];
};

const assignmentLabelIds = (docs: DocSnapshot[]) =>
  [...new Set(docs.flatMap((entry) => {
    const id = entry.data()?.labelId;
    return typeof id === "string" && id.length > 0 ? [id] : [];
  }))];

export const asignLabelToDay = async (day: Day) => {
  const userId = GetCurrentUserId();
  const { date, labelId } = DaySchema.parse(day);
  const refs = await dateAssignmentRefs(userId, date);

  return runTransaction(getFirestore(), async (transaction) => {
    const snapshots = await Promise.all(refs.map((ref) => transaction.get(ref)));
    const existing = snapshots.filter((entry) => entry.exists());
    const labelIds = [...new Set([labelId, ...assignmentLabelIds(existing)])];
    const labels = await Promise.all(
      labelIds.map((id) => transaction.get(labelDoc(userId, id))),
    );
    const target = labels[0];
    if (!target.exists()) throw new Error("Label not found.");

    const isUpdate = existing.length > 0;
    const timestamp = serverTimestamp();
    transaction.set(refs[0], {
      date,
      labelId,
      createdAt: existing[0]?.data()?.createdAt ?? timestamp,
      ...(isUpdate ? { updatedAt: timestamp } : {}),
    });
    existing.filter((entry) => entry.id !== date).forEach((entry) => transaction.delete(entry.ref));
    transaction.update(target.ref, { dates: arrayUnion(date) });
    for (const previous of labels.slice(1)) {
      if (previous.exists()) transaction.update(previous.ref, { dates: arrayRemove(date) });
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
  const canonical = await getDoc(
    doc(getFirestore(), "users", userId, "dayAssignments", validatedDate),
  );
  const fallback = async (): Promise<QueryDoc | undefined> => {
    const snapshot: QueryResult = await getDocs(
      query(assignmentsCollection(userId), where("date", "==", validatedDate), limit(1)),
    );
    return snapshot.docs[0];
  };
  const assignment: DocSnapshot | QueryDoc | undefined = canonical.exists()
    ? canonical
    : await fallback();
  if (!assignment) return null;
  const labelId = assignment.data()?.labelId;
  if (typeof labelId === "string" && labelId) {
    const label = await getDoc(labelDoc(userId, labelId));
    if (label.exists()) return LabelWithIdSchema.parse({ id: label.id, ...label.data() });
  }

  // Recheck the orphan inside a transaction so cleanup cannot erase a date
  // that another writer reassigned after our initial read.
  return runTransaction(getFirestore(), async (transaction) => {
    const current = await transaction.get(assignment.ref);
    if (!current.exists()) return null;
    const currentLabelId = current.data()?.labelId;
    if (typeof currentLabelId !== "string" || !currentLabelId) {
      transaction.delete(current.ref);
      return null;
    }
    const label = await transaction.get(labelDoc(userId, currentLabelId));
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
  const refs = await dateAssignmentRefs(userId, validatedDate);

  return runTransaction(getFirestore(), async (transaction) => {
    const snapshots = await Promise.all(refs.map((ref) => transaction.get(ref)));
    const existing = snapshots.filter((entry) => entry.exists());
    if (!existing.length) throw new Error("No label assignment found for this date.");
    const labels = await Promise.all(
      assignmentLabelIds(existing).map((id) => transaction.get(labelDoc(userId, id))),
    );
    existing.forEach((entry) => transaction.delete(entry.ref));
    for (const label of labels) {
      if (label.exists()) transaction.update(label.ref, { dates: arrayRemove(validatedDate) });
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
    const snapshot: QueryResult = await getDocs(
      query(
        collection(getFirestore(), "users", userId, "fitnessLogs"),
        where("date", "==", mostRecentDate),
      ),
    );

    if (!snapshot.empty) {
      return snapshot.docs.map((entry) =>
        ExerciseLogWithIdSchema.parse({ id: entry.id, ...entry.data() }),
      );
    }

    mostRecentDate = findMostRecentSessionDate(dates, mostRecentDate);
  }
};
