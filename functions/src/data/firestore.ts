import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Cloud Functions reuse warm instances, so initializing twice throws.
if (getApps().length === 0) {
  initializeApp();
}

export const db = getFirestore();

export const userDoc = (uid: string) => db.collection("users").doc(uid);

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

/**
 * The append-only record of every analytics consent change.
 *
 * TOP-LEVEL for the same reason as aiUsage, and the reason matters more here,
 * because this is evidence. Firestore rules only ever GRANT access — a narrower
 * rule cannot take back what a broader one allows — so anything stored under
 * users/{uid}/ falls to the blanket allow at firestore.rules:18-20 and the user
 * can delete it. A consent log the user can delete proves nothing, which is the
 * entire point of keeping one. Out here the catch-all deny at
 * firestore.rules:26-28 applies and only the Admin SDK can write.
 *
 * Deliberately survives account deletion. The moment this record is needed is
 * exactly when someone who has deleted their account disputes having consented,
 * so removing it with the account would destroy the evidence precisely when it
 * matters. What makes that defensible is that it holds nothing personal: a uid,
 * a flag, and a timestamp. No name, no email, no content.
 *
 * Nothing here is ever updated or deleted. One document per change, forever.
 */
export const consentEventsCollection = () => db.collection("consentEvents");

/**
 * Where the RevenueCat Firebase extension writes one document per customer.
 *
 * MUST match the extension's "customers collection" setting exactly. The
 * trigger that watches it is built from this constant, so a mismatch means
 * purchases are silently never applied.
 *
 * TOP-LEVEL, NEVER users/{uid}/…, even though the extension's install screen
 * suggests that path. firestore.rules:18-20 lets every user write anything
 * under their own users/{uid}, so a customer document there could be edited
 * by its owner to read "max until 2099". Out here the catch-all deny at
 * firestore.rules:26-28 applies, exactly as it does for aiUsage.
 *
 * The document id is RevenueCat's app_user_id — the Firebase uid only if the
 * app called Purchases.logIn(uid) before the purchase. Anything else (an
 * "$RCAnonymousID:…", a deleted account) is refused by syncCustomer.
 */
export const REVENUECAT_CUSTOMERS_COLLECTION = "revenuecatCustomers";

export const revenueCatCustomerDoc = (appUserId: string) =>
  db.collection(REVENUECAT_CUSTOMERS_COLLECTION).doc(appUserId);

/**
 * One document per RevenueCat webhook event we have processed.
 *
 * TOP-LEVEL for the same reason as aiUsage: the catch-all deny at
 * firestore.rules:26-28 covers every path outside /users/{userId}, so no
 * client can read or write these, while the Admin SDK writes them freely.
 *
 * THE DOCUMENT ID IS RevenueCat's `event.id`, and that is the entire
 * mechanism. RevenueCat retries a failed delivery five times and warns that
 * the same event may arrive more than once; creating a document whose id is
 * the event id makes a second attempt fail rather than reprocess. It only
 * works because the create happens INSIDE the same transaction as the change
 * it guards — checked outside, two concurrent deliveries both see nothing and
 * both apply.
 *
 * Holds an `expireAt` for a Firestore TTL policy. NOTE that writing the field
 * does not enable anything on its own: the TTL policy has to be configured on
 * this collection in the console or via gcloud, pointing at `expireAt`.
 * Without it these documents simply accumulate forever, which is untidy but
 * not dangerous.
 */
export const rcEventDoc = (eventId: string) =>
  db.collection("rcEvents").doc(eventId);
