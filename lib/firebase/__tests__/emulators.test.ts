const mockConnectAuthEmulator = jest.fn();
const mockConnectFirestoreEmulator = jest.fn();
const mockConnectFunctionsEmulator = jest.fn();
const mockGetFunctions = jest.fn((_app: unknown, region: string) => ({
  region,
}));
const mockConstants: { expoConfig: { hostUri?: string } | null } = {
  expoConfig: { hostUri: "192.168.1.20:8081" },
};

jest.mock("@react-native-firebase/app", () => ({ getApp: () => "app" }));
jest.mock("@react-native-firebase/auth", () => ({
  getAuth: () => "auth",
  connectAuthEmulator: mockConnectAuthEmulator,
}));
jest.mock("@react-native-firebase/firestore", () => ({
  getFirestore: () => "firestore",
  connectFirestoreEmulator: mockConnectFirestoreEmulator,
}));
jest.mock("@react-native-firebase/functions", () => ({
  getFunctions: mockGetFunctions,
  connectFunctionsEmulator: mockConnectFunctionsEmulator,
}));
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: mockConstants,
}));

const ORIGINAL_FLAG = process.env.EXPO_PUBLIC_USE_EMULATORS;
const globalWithDev = global as typeof global & { __DEV__: boolean };

/** The module connects at import time, so each case loads a fresh copy. */
const loadEmulators = ({
  flag,
  isDev,
}: {
  flag: string | undefined;
  isDev: boolean;
}): typeof import("../emulators") => {
  if (flag === undefined) {
    delete process.env.EXPO_PUBLIC_USE_EMULATORS;
  } else {
    process.env.EXPO_PUBLIC_USE_EMULATORS = flag;
  }
  globalWithDev.__DEV__ = isDev;

  let loaded: typeof import("../emulators") | undefined;
  jest.isolateModules(() => {
    // A fresh require per case: the module connects at import time.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    loaded = require("../emulators");
  });
  return loaded!;
};

const expectNoConnections = () => {
  expect(mockConnectAuthEmulator).not.toHaveBeenCalled();
  expect(mockConnectFirestoreEmulator).not.toHaveBeenCalled();
  expect(mockConnectFunctionsEmulator).not.toHaveBeenCalled();
};

beforeEach(() => {
  jest.clearAllMocks();
  mockConstants.expoConfig = { hostUri: "192.168.1.20:8081" };
});

afterAll(() => {
  process.env.EXPO_PUBLIC_USE_EMULATORS = ORIGINAL_FLAG;
  globalWithDev.__DEV__ = true;
});

describe("emulators", () => {
  test("stays on the live project when the flag is not set", () => {
    const { isUsingEmulators } = loadEmulators({
      flag: undefined,
      isDev: true,
    });

    expect(isUsingEmulators).toBe(false);
    expectNoConnections();
  });

  test("connects auth, firestore and functions to the Metro host", () => {
    const { isUsingEmulators } = loadEmulators({ flag: "true", isDev: true });

    expect(isUsingEmulators).toBe(true);
    expect(mockConnectAuthEmulator).toHaveBeenCalledWith(
      "auth",
      "http://192.168.1.20:9099",
    );
    expect(mockConnectFirestoreEmulator).toHaveBeenCalledWith(
      "firestore",
      "192.168.1.20",
      8080,
    );
    expect(mockConnectFunctionsEmulator).toHaveBeenCalledWith(
      { region: "europe-west2" },
      "192.168.1.20",
      5001,
    );
  });

  test("never connects in a release build, even with the flag set", () => {
    const { isUsingEmulators } = loadEmulators({ flag: "true", isDev: false });

    expect(isUsingEmulators).toBe(false);
    expectNoConnections();
  });

  test("falls back to localhost when Metro's address is unknown", () => {
    mockConstants.expoConfig = null;

    loadEmulators({ flag: "true", isDev: true });

    expect(mockConnectFirestoreEmulator).toHaveBeenCalledWith(
      "firestore",
      "localhost",
      8080,
    );
  });
});
