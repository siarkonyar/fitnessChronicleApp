import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Cloud Functions reuse warm instances, so initializing twice throws.
if (getApps().length === 0) {
  initializeApp();
}

export const db = getFirestore();

const userDoc = (uid: string) => db.collection("users").doc(uid);

/**
 * Every collection the coach reads lives under one user's document.
 *
 * These take `uid` as a required argument for a reason: the Admin SDK bypasses
 * security rules entirely, so nothing downstream will stop a wrong uid from
 * reading a stranger's training data. The uid must always originate from the
 * callable's verified auth context — never from tool arguments the model chose,
 * and never from the request body.
 */
export const fitnessLogsCollection = (uid: string) =>
  userDoc(uid).collection("fitnessLogs");

export const labelsCollection = (uid: string) =>
  userDoc(uid).collection("labels");

export const programsCollection = (uid: string) =>
  userDoc(uid).collection("programs");

/**
 * The user's AI usage counter.
 *
 * Deliberately TOP-LEVEL, not under users/{uid}/. The catch-all deny at
 * firestore.rules:26-28 covers every path outside /users/{userId}, so no client
 * can read or write this document — while the Admin SDK, which bypasses rules
 * entirely, writes it freely.
 *
 * That placement is what lets this feature ship without touching the security
 * rules. Under users/{uid}/ it would fall to the blanket allow at
 * firestore.rules:18, and a user who can edit their own usage counter — or
 * their own tier — has no quota at all.
 */
export const aiUsageDoc = (uid: string) => db.collection("aiUsage").doc(uid);
