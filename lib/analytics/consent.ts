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
 * False. Absent means "never asked", and under a consent model never-asked is
 * not permission — it is the absence of it. An earlier version of this file
 * defaulted to true on the reasoning that reading silence as refusal would
 * switch analytics off for every existing user. That reasoning had it exactly
 * backwards: switching them off is the correct outcome, because none of them
 * were ever asked. The cost is real and is meant to be paid.
 *
 * Onboarding now asks outright (lib/analytics/consentPrompt.ts), so new users
 * reach the app with a stored answer either way and never see this default.
 * It applies to users who onboarded before the prompt existed, who stay off
 * until they turn analytics on in Settings.
 */
const DEFAULT_CONSENT = false;

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
