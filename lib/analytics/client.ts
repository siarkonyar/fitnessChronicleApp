/**
 * The only file in the app that talks to the Firebase Analytics SDK.
 *
 * Two rules shape everything here:
 *
 * 1. Analytics must never break the app. Every call is fire-and-forget and
 *    swallows its own failure. Reporting that someone logged a workout is
 *    worth nothing next to actually logging it, so a telemetry fault must not
 *    surface as a rejected promise inside a mutation callback.
 *
 * 2. Consent has exactly one switch: setAnalyticsCollectionEnabled on the SDK.
 *    There is deliberately no parallel `isEnabled` boolean in JS. A second copy
 *    of that state would have to be re-synced on every change and would drift
 *    the moment one update was missed — and the SDK switch is strictly
 *    stronger anyway, since it also stops the automatic events (session_start,
 *    app_open) that never pass through this file.
 */

import {
  getAnalytics,
  logEvent as firebaseLogEvent,
  setAnalyticsCollectionEnabled as firebaseSetCollectionEnabled,
  setUserId as firebaseSetUserId,
  setUserProperty as firebaseSetUserProperty,
} from "@react-native-firebase/analytics";
import type { AnalyticsEventMap, AnalyticsEventName } from "./events";

/** GA4 hard limits. Exceeding any of these makes the SDK drop the event. */
const MAX_PARAMS = 25;
const MAX_PARAM_NAME_LENGTH = 40;
const MAX_STRING_VALUE_LENGTH = 100;

type ParamValue = string | number | boolean;

/**
 * The SDK's logEvent, with one type-level constraint relaxed.
 *
 * Its generic overload is declared `CustomEventName<T> = T extends
 * EventNameString ? never : T` — it deliberately refuses GA4's own recommended
 * names so you use the per-event overloads instead. Those overloads cannot be
 * resolved against a generic union, so `logEvent<K>` below fails to compile the
 * moment the union contains login, sign_up, or screen_view.
 *
 * The cast is safe: the runtime implementation is plain `name: string`, and
 * none of the names in events.ts appear in the SDK's ReservedEventNames list
 * (the only names it rejects at runtime). Type safety for callers is unaffected
 * — it comes from AnalyticsEventMap, one layer up.
 */
const sendEvent = firebaseLogEvent as (
  analytics: ReturnType<typeof getAnalytics>,
  name: string,
  params?: Record<string, ParamValue>,
) => Promise<void>;

/**
 * Fails loudly in development, silently in production.
 *
 * A dropped event is not worth an alert in someone's gym session, but it is
 * absolutely worth seeing while wiring the events up — a silent no-op here
 * would look identical to analytics simply not being enabled yet.
 */
const reportFailure = (context: string, error: unknown): void => {
  if (__DEV__) {
    console.warn(`[analytics] ${context} failed:`, error);
  }
};

/**
 * Clamps one value to what GA4 accepts.
 *
 * Numbers and booleans pass through; everything else is stringified and cut to
 * 100 characters. The truncation is a backstop, not a licence — events.ts
 * forbids free text, so nothing reaching here should be long enough to trim.
 */
const toParamValue = (value: unknown): ParamValue | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;

  return String(value).slice(0, MAX_STRING_VALUE_LENGTH);
};

/**
 * The analytics instance, or null if it cannot be reached.
 *
 * getAnalytics() throws SYNCHRONOUSLY when the native module is missing — a
 * build made before the package was installed, a stale dev client, a failed
 * link. A .catch() on the returned promise does not help, because there is no
 * promise: the throw escapes into whichever React effect made the call and red
 * screens the app.
 *
 * That is exactly the failure this file claims at the top it will never cause.
 * Every entry point below goes through here and gives up quietly instead, so a
 * missing module costs telemetry and nothing else.
 */
const getAnalyticsSafely = (): ReturnType<typeof getAnalytics> | null => {
  try {
    return getAnalytics();
  } catch (error) {
    reportFailure("getAnalytics", error);
    return null;
  }
};

/**
 * Drops empty values and anything past GA4's ceilings.
 *
 * Returns a new object rather than editing the caller's params — the caller
 * often builds these inline from state, and mutating that would be a hidden
 * side effect in a code path they cannot see.
 */
const sanitizeParams = (
  params: Record<string, unknown>,
): Record<string, ParamValue> =>
  Object.entries(params)
    .slice(0, MAX_PARAMS)
    .reduce<Record<string, ParamValue>>((accumulator, [key, rawValue]) => {
      const value = toParamValue(rawValue);
      if (value === null) return accumulator;

      return { ...accumulator, [key.slice(0, MAX_PARAM_NAME_LENGTH)]: value };
    }, {});

/**
 * Reports one event.
 *
 * The generic ties `params` to the specific event named, so passing
 * ai_message_sent's params to ai_chat_opened is a compile error rather than a
 * column of nulls discovered in GA4 three weeks later.
 */
export const logEvent = <K extends AnalyticsEventName>(
  name: K,
  params: AnalyticsEventMap[K],
): void => {
  const safeParams = sanitizeParams(params);

  if (__DEV__) {
    console.log(`[analytics] ${name}`, safeParams);
  }

  const instance = getAnalyticsSafely();
  if (!instance) return;

  sendEvent(instance, name, safeParams).catch((error: unknown) =>
    reportFailure(`logEvent(${name})`, error),
  );
};

/**
 * Reports a screen change.
 *
 * Sent as a plain screen_view event because the dedicated logScreenView helper
 * is deprecated in this SDK version. screen_class repeats screen_name: there is
 * no native view controller name to report from a JS route, and leaving it
 * unset makes GA4's screen reports group everything under one blank class.
 */
export const logScreenView = (screenName: string): void => {
  const name = screenName.slice(0, MAX_STRING_VALUE_LENGTH);

  if (__DEV__) {
    console.log("[analytics] screen_view", name);
  }

  const instance = getAnalyticsSafely();
  if (!instance) return;

  sendEvent(instance, "screen_view", {
    screen_name: name,
    screen_class: name,
  }).catch((error: unknown) => reportFailure("logScreenView", error));
};

/**
 * Ties events to a user, or unties them on sign-out.
 *
 * Pass the Firebase uid and nothing else. Email, display name, and anything
 * else that identifies a person outside our own database are prohibited in
 * GA4 and would put the property at risk of deletion.
 */
export const setUserId = (uid: string | null): void => {
  const instance = getAnalyticsSafely();
  if (!instance) return;

  firebaseSetUserId(instance, uid).catch((error: unknown) =>
    reportFailure("setUserId", error),
  );
};

/** Sets one user property. Same privacy rule as setUserId: no personal data. */
export const setUserProperty = (key: string, value: string | null): void => {
  const instance = getAnalyticsSafely();
  if (!instance) return;

  firebaseSetUserProperty(
    instance,
    key.slice(0, MAX_PARAM_NAME_LENGTH),
    value === null ? null : value.slice(0, MAX_STRING_VALUE_LENGTH),
  ).catch((error: unknown) => reportFailure(`setUserProperty(${key})`, error));
};

/**
 * Turns collection on or off. The single source of truth for consent.
 *
 * Applied at boot from the stored preference and again whenever the Settings
 * toggle moves. Disabling stops the automatic events too, not just the ones
 * this file sends.
 */
export const setCollectionEnabled = (enabled: boolean): void => {
  const instance = getAnalyticsSafely();
  if (!instance) return;

  firebaseSetCollectionEnabled(instance, enabled).catch((error: unknown) =>
    reportFailure("setCollectionEnabled", error),
  );
};
