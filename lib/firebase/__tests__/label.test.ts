import { asignLabelToDay, deleteAssignment } from "../label";
import {
  TEST_UID,
  readDoc,
  resetFirestore,
  seedDoc,
} from "./firestoreTestUtils";

jest.mock("@react-native-firebase/firestore", () =>
  require("./firestoreTestUtils"),
);

jest.mock("@react-native-firebase/auth", () => ({
  __esModule: true,
  default: () => ({ currentUser: { uid: "test-user" } }),
}));

beforeEach(() => {
  resetFirestore();
});

describe("label", () => {
  test("assigning a label to a date adds that date to the labels dates array", async () => {
    // Arrange — a label that exists but has no dates yet
    seedDoc(["users", TEST_UID, "labels", "push"], {
      label: "Push",
      description: "Push day",
      dates: [],
    });

    // Act
    await asignLabelToDay({ date: "2026-06-01", labelId: "push" });

    // Assert — the date is now stored on the label
    expect(readDoc(["users", TEST_UID, "labels", "push"])?.dates).toEqual([
      "2026-06-01",
    ]);
  });

  test("deleting an assignment removes that date from the label's dates array", async () => {
    // Arrange — the label already has the date, and an assignment doc exists
    seedDoc(["users", TEST_UID, "labels", "push"], {
      label: "Push",
      description: "Push day",
      dates: ["2026-06-01"],
    });
    seedDoc(["users", TEST_UID, "dayAssignments", "a1"], {
      date: "2026-06-01",
      labelId: "push",
    });

    // Act
    await deleteAssignment("2026-06-01");

    // Assert — date gone from the label, and the assignment doc is gone too
    expect(readDoc(["users", TEST_UID, "labels", "push"])?.dates).toEqual([]);
    expect(
      readDoc(["users", TEST_UID, "dayAssignments", "a1"]),
    ).toBeUndefined();
  });

  test("changing a date's label removes the date from the previous label", async () => {
    // Arrange — date currently belongs to "push"; "pull" exists and is empty
    seedDoc(["users", TEST_UID, "labels", "push"], {
      label: "Push",
      description: "Push day",
      dates: ["2026-06-01"],
    });
    seedDoc(["users", TEST_UID, "labels", "pull"], {
      label: "Pull",
      description: "Pull day",
      dates: [],
    });
    seedDoc(["users", TEST_UID, "dayAssignments", "a1"], {
      date: "2026-06-01",
      labelId: "push",
    });

    // Act — reassign the same date to "pull"
    await asignLabelToDay({ date: "2026-06-01", labelId: "pull" });

    // Assert — removed from old label, added to new label
    expect(readDoc(["users", TEST_UID, "labels", "push"])?.dates).toEqual([]);
    expect(readDoc(["users", TEST_UID, "labels", "pull"])?.dates).toEqual([
      "2026-06-01",
    ]);
  });
});
