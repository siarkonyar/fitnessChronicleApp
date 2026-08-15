// Entry point for the Hercule Cloud Functions codebase.
// Every deployed function must be re-exported from this file.

import { onCall, HttpsError, CallableRequest } from "firebase-functions/https";

/**
 * Region for every function in this codebase.
 *
 * Must match the Firestore location in firebase.json ("europe-west2"), so
 * reads stay inside one region instead of crossing the Atlantic per query.
 */
export const REGION = "europe-west2";

interface PingResponse {
  uid: string;
  echo: unknown;
  receivedAt: string;
}

/**
 * A deliberately trivial callable, used to prove the plumbing works before
 * any AI code exists: request in, auth resolved, response out.
 *
 * It is not part of the coach. Keep it as a health check.
 */
export const ping = onCall(
  { region: REGION, maxInstances: 2 },
  (request: CallableRequest): PingResponse => {
    // request.auth is set by the SDK only after it has verified the caller's
    // Firebase ID token. An unsigned or forged token leaves it undefined.
    //
    // Check uid explicitly, not just request.auth: the emulator does NOT
    // verify token signatures, so a malformed token there yields an auth
    // object with no uid. Production rejects such tokens, but a guard that
    // only ever holds in production is a guard you cannot test.
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "You must be signed in.");
    }

    return {
      // The one trustworthy uid. Never read a uid out of request.data.
      uid,
      // request.data is whatever the caller sent — untrusted, unvalidated.
      // Echoed back as `unknown` here precisely because nothing has checked it.
      echo: request.data,
      receivedAt: new Date().toISOString(),
    };
  }
);
