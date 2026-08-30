import { useAuth } from "@/context/AuthContext";
import { setCollectionEnabled, setUserId } from "@/lib/analytics/client";
import { applyStoredConsent } from "@/lib/analytics/consent";
import { useEffect } from "react";

/**
 * Keeps analytics in step with who is signed in.
 *
 * Collection is off when the app launches (analytics_auto_collection_enabled in
 * firebase.json). This hook is what turns it on, and only ever after reading
 * the signed-in user's stored choice — so the gap between launch and knowing
 * that choice collects nothing rather than collecting and apologising later.
 *
 * Signing out switches collection back off and clears the user id. Not merely
 * tidy: without it the next person to sign in on the same device would have
 * their first events filed under the previous user, and would be collected from
 * before anyone had read their consent.
 *
 * Mounted once, in AppSetup.
 */
export function useAnalyticsConsent(): void {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  useEffect(() => {
    if (uid === null) {
      setUserId(null);
      // Switched off directly rather than by re-reading. applyStoredConsent
      // goes through getUserSettings, which throws when nobody is signed in —
      // so calling it here would leave collection exactly as the previous user
      // left it, which is the one outcome sign-out must not produce.
      setCollectionEnabled(false);
      return;
    }

    setUserId(uid);

    applyStoredConsent().catch((error: unknown) => {
      // Left off, deliberately — see applyStoredConsent. Worth surfacing while
      // developing, since "no events at all" and "analytics not wired up yet"
      // look identical from the outside.
      if (__DEV__) {
        console.warn("[analytics] could not read consent, staying off:", error);
      }
    });
  }, [uid]);
}
