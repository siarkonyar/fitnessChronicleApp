import { Alert } from "react-native";

/** The published policy. Shown from onboarding and linked from Settings. */
export const PRIVACY_POLICY_URL = "https://siarkonyar.com/privacy";

/**
 * The consent wording.
 *
 * Kept here rather than inline in the onboarding screen because this text is
 * the consent itself: what it claims is what the user agreed to, and it has to
 * stay true to both lib/analytics/events.ts and section 2.6 of the policy. A
 * string that lives in a UI file gets reworded by whoever is adjusting the
 * layout that day.
 *
 * Two things it deliberately does NOT say:
 *
 *  - "Anonymous". setUserId attaches the Firebase uid to every event
 *    (client.ts), so this data is pseudonymous. Calling it anonymous would be
 *    a claim the code contradicts.
 *  - "Crashes". Crashlytics is not wired to this switch — it collects whatever
 *    the user answers here. Naming it would promise a control that does not
 *    exist yet.
 */
const TITLE = "Help improve Hercule?";

const MESSAGE =
  "We'd like to collect usage data — which features get used, and how often. " +
  "Never your workouts, your weights, or anything you type.\n\n" +
  "You can change this any time in Settings.";

/**
 * Asks for analytics consent and resolves with the answer.
 *
 * Resolves false on every path that is not an explicit "Allow". Silence is not
 * consent, so a dismissed alert has to come back as a refusal rather than as
 * nothing at all.
 *
 * cancelable: false stops Android's back button and outside-taps from closing
 * the alert without an answer. onDismiss is kept anyway as a backstop — it is
 * Android-only and should never fire while cancelable is false, but if it ever
 * did, a promise that never settles would strand the caller mid-submit with a
 * button stuck on "Saving...". Resolving twice is harmless; hanging is not.
 */
export const askForAnalyticsConsent = (): Promise<boolean> =>
  new Promise((resolve) => {
    Alert.alert(
      TITLE,
      MESSAGE,
      [
        { text: "Not now", style: "cancel", onPress: () => resolve(false) },
        { text: "Allow", onPress: () => resolve(true) },
      ],
      { cancelable: false, onDismiss: () => resolve(false) },
    );
  });
