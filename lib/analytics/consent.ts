/**
 * Analytics consent: one source of truth, and it lives on the server.
 *
 * The stored value is users/{uid}.analyticsConsent in Firestore. There is
 * deliberately no second copy in AsyncStorage — Firestore already keeps its own
 * offline cache on the device, so a local mirror would buy nothing and would
 * have to be kept in step forever. Two copies of one truth is how you end up
 * unable to say which one is right.
 *
 * Collection starts OFF at launch, set by analytics_auto_collection_enabled in
 * firebase.json. Nothing is collected until the value below has been read and
 * applied, so a user who opted out is not sampled during the seconds it takes
 * to sign in and read their settings.
 *
 * The tamper-proof record of every change is written server-side by the
 * onConsentChanged trigger, which fires on the Firestore write this file makes.
 * Nothing here reports it — a client-written audit log would prove nothing.
 */

import { getUserSettings, updateUserSettings } from "@/lib/firebase/user";
import { setCollectionEnabled } from "./client";

/**
 * What a user with nothing stored gets.
 *
 * True, matching Firebase's own default and the opt-out model this app uses.
 * Absent means "never asked", not "said no" — every user who predates this
 * feature has no value stored, and reading them as refusals would silently
 * switch analytics off for the entire existing user base.
 */
const DEFAULT_CONSENT = true;

/**
 * Reads the stored choice and applies it to the SDK.
 *
 * Called once the user is known. Offline this is answered from Firestore's
 * local cache, so a returning user's choice is honoured on a plane just as it
 * is at home.
 *
 * A read failure leaves collection off rather than falling back to the default.
 * Off is the recoverable direction: the next launch tries again and the only
 * cost is one session of missing data, where guessing "on" for someone who
 * actually opted out is the exact mistake this whole file exists to prevent.
 */
export const applyStoredConsent = async (): Promise<void> => {
  const settings = await getUserSettings();

  setCollectionEnabled(settings.analyticsConsent ?? DEFAULT_CONSENT);
};

/**
 * Records a new choice and applies it immediately.
 *
 * The SDK is flipped first, before the write is confirmed. Someone switching
 * this off wants it off now, not once the network agrees — and if the write
 * later fails, having stopped collecting is the harmless outcome in a way that
 * having kept collecting is not.
 *
 * The Firestore write is intentionally not awaited. Offline, its promise stays
 * pending until connectivity returns, so awaiting it would hang the Settings
 * toggle on exactly the users the offline mode exists for. The write is queued
 * and durable regardless, and it is what fires the server-side audit record.
 */
export const setAnalyticsConsent = (granted: boolean): void => {
  setCollectionEnabled(granted);

  updateUserSettings({ analyticsConsent: granted }).catch((error: unknown) => {
    console.error("Failed to persist analytics consent:", error);
  });
};
