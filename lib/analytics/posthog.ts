import Constants from "expo-constants";
import PostHog from "posthog-react-native";

type PostHogExtra = {
  posthogProjectToken?: string;
  posthogHost?: string;
};

const extra = Constants.expoConfig?.extra as PostHogExtra | undefined;
let collectionEnabled = false;
let collectionRequested = false;
let currentUid: string | null | undefined;
let consentRevision = 0;
let consentUpdate = Promise.resolve();

const reportFailure = (error: unknown): void => {
  if (__DEV__) console.warn("[analytics] PostHog setup failed:", error);
};

/** Expo embeds these public settings when it evaluates app.config.js. */
const createClient = (): PostHog | undefined => {
  if (!extra?.posthogProjectToken || !extra.posthogHost) {
    if (__DEV__) {
      console.warn("[analytics] PostHog is disabled. Set POSTHOG_PROJECT_TOKEN and POSTHOG_HOST.");
    }
    return undefined;
  }

  try {
    return new PostHog(extra.posthogProjectToken, {
      host: extra.posthogHost,
      defaultOptIn: false,
      captureAppLifecycleEvents: false,
      // Block capture until the current account's stored consent is applied.
      // This also blocks a persisted opt-in from an earlier app session.
      before_send: (event) => collectionEnabled ? event : null,
      logs: {
        serviceName: "fitnesschronicle-mobile",
        environment: __DEV__ ? "development" : "production",
        serviceVersion: Constants.expoConfig?.version,
        beforeSend: (log) => collectionEnabled ? log : null,
      },
      errorTracking: {
        autocapture: {
          uncaughtExceptions: true,
          unhandledRejections: true,
          console: [],
        },
      },
    });
  } catch (error) {
    reportFailure(error);
    return undefined;
  }
};

export const posthog = createClient();

export const isPostHogCollectionEnabled = (): boolean => collectionEnabled;
/** Wait for opt-in without moving an event to another account or consent state. */
export const runWithPostHogConsent = (run: (client: PostHog) => void): void => {
  if (!collectionRequested || !posthog) return;
  const client = posthog;
  if (collectionEnabled) {
    try {
      run(client);
    } catch (error) {
      reportFailure(error);
    }
    return;
  }
  const revision = consentRevision;
  void consentUpdate.then(() => {
    if (revision === consentRevision && collectionEnabled) run(client);
  }).catch(reportFailure);
};

export const setPostHogCollectionEnabled = (enabled: boolean): void => {
  collectionEnabled = false;
  collectionRequested = enabled && Boolean(posthog) && Boolean(currentUid);
  const revision = ++consentRevision;
  consentUpdate = Promise.resolve();
  try {
    if (collectionRequested && posthog && currentUid) {
      const client = posthog;
      const uid = currentUid;
      consentUpdate = client.ready().then(async () => {
        if (revision !== consentRevision) return;
        await client.optIn();
        if (revision !== consentRevision) return;
        collectionEnabled = true;
        // Identify after opt-in. Do not send email addresses or names.
        client.identify(uid);
      }).catch((error: unknown) => {
        if (revision === consentRevision) collectionEnabled = false;
        reportFailure(error);
      });
    } else {
      void posthog?.optOut().catch(reportFailure);
    }
  } catch (error) {
    collectionEnabled = false;
    reportFailure(error);
  }
};

/** Call at the auth boundary, before React renders the new account. */
export const setPostHogUser = (uid: string | null): void => {
  if (uid === currentUid) return;
  currentUid = uid;
  setPostHogCollectionEnabled(false);
  try {
    // Clear an old persisted identity on the first auth result as well.
    posthog?.reset();
  } catch (error) {
    reportFailure(error);
  }
};
