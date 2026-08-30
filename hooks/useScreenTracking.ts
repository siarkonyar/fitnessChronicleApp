import { logScreenView } from "@/lib/analytics/client";
import { usePathname } from "expo-router";
import { useEffect } from "react";

/**
 * Reports a screen_view whenever the route changes.
 *
 * This is the app's only source of screen_view. Firebase's own automatic screen
 * reporting is switched off in firebase.json, on purpose: it reports the native
 * view controller, which for a React Native app is one container hosting every
 * route. Left on alongside this hook it would both double-count and file most
 * of the traffic under a single meaningless screen name.
 *
 * The pathname is safe to send as-is because every route in app/ is a static
 * segment. Should a dynamic route ever appear — app/exercise/[id].tsx and the
 * like — the id would land in GA4 as part of the screen name, and this hook has
 * to strip it before that ships.
 *
 * No manual de-duplication: the effect is keyed on pathname, so re-renders that
 * do not change the route do not fire.
 */
export function useScreenTracking(): void {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;

    logScreenView(pathname);
  }, [pathname]);
}
