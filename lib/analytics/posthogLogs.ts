import { runWithPostHogConsent } from "./posthog";

type LogAttributes = Record<string, string | number | boolean>;

/**
 * The only logger whose output is exported to PostHog Logs. Keep its messages
 * operational, static, and free of user data so existing console and SDK logs
 * remain local to the app.
 */
const logInfo = (body: string, attributes: LogAttributes = {}): void => {
  runWithPostHogConsent((client) => {
    client.logger.info(body, {
      logger: "posthog_app_lifecycle",
      ...attributes,
    });
  });
};

export const logAnalyticsCollectionEnabled = (): void => {
  logInfo("analytics collection enabled");
};

export const logStoredConsentApplied = (): void => {
  logInfo("stored analytics consent applied", { source: "stored_preference" });
};

export const logUserConsentEnabled = (): void => {
  logInfo("analytics consent enabled in settings", { source: "settings" });
};
