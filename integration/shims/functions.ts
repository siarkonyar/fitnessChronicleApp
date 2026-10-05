/**
 * Stand-in for @react-native-firebase/functions over the JS SDK and the
 * Functions emulator.
 *
 * Errors are reshaped to what RNFB's HttpsError carries on device: the code
 * WITHOUT the "functions/" prefix the JS SDK adds ("resource-exhausted", not
 * "functions/resource-exhausted"), plus `details`. Keeping the device shape is
 * what lets these tests catch app code that matches on the wrong spelling.
 */
import * as jsFunctions from "firebase/functions";
import type { FirebaseApp } from "firebase/app";
import { EMULATOR_HOST } from "./app";

const FUNCTIONS_PORT = 5001;
const connected = new WeakSet<jsFunctions.Functions>();

export const getFunctions = (app: FirebaseApp, region?: string): jsFunctions.Functions => {
  const functions = jsFunctions.getFunctions(app, region);
  if (!connected.has(functions)) {
    jsFunctions.connectFunctionsEmulator(functions, EMULATOR_HOST, FUNCTIONS_PORT);
    connected.add(functions);
  }
  return functions;
};

export class HttpsError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details: unknown,
  ) {
    super(message);
  }
}

const asRnfbError = (error: unknown): never => {
  const { code, message, details } = error as { code?: string; message?: string; details?: unknown };
  throw new HttpsError((code ?? "unknown").replace(/^functions\//, ""), message ?? "", details ?? null);
};

export const httpsCallable =
  <Req = unknown, Res = unknown>(functions: jsFunctions.Functions, name: string) =>
  async (data?: Req): Promise<{ data: Res }> => {
    const callable = jsFunctions.httpsCallable<Req, Res>(functions, name);
    const result = await callable(data as Req).catch(asRnfbError);
    return { data: result.data };
  };
