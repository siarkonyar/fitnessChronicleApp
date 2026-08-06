import firestore, {
  FirebaseFirestoreTypes,
} from "@react-native-firebase/firestore";
import { z } from "zod";

// TODO: Update to use RN Firebase Timestamp
const FirestoreTimestampSchema = z.union([
  z.date(),
  z
    .custom<FirebaseFirestoreTypes.Timestamp>(
      (val) => val instanceof firestore.Timestamp,
      {
        message: "Expected a Firebase Firestore Timestamp object",
      },
    )
    .transform((timestamp) => timestamp.toDate()),
]);

export const SetSchema = z.discriminatedUnion("measure", [
  z.object({
    measure: z.literal("kg"),
    setType: z.enum(["warmup", "normal", "failure", "drop", "pr", "failedpr"]),
    value: z.string().optional(),
    reps: z.string().optional(),
  }),
  z.object({
    measure: z.literal("lbs"),
    setType: z.enum(["warmup", "normal", "failure", "drop", "pr", "failedpr"]),
    value: z.string().optional(),
    reps: z.string().optional(),
  }),
  z.object({
    measure: z.literal("time"),
    setType: z.enum(["warmup", "normal", "failure", "pr"]),
    value: z.string().optional(),
  }),
  z.object({
    measure: z.literal("distance"),
    setType: z.enum(["warmup", "normal", "failure", "pr"]),
    value: z.string().optional(),
  }),
  z.object({
    measure: z.literal("steps"),
    setType: z.enum(["warmup", "normal", "failure", "pr"]),
    value: z.string().optional(),
  }),
]);

/* export const SetSchema = z.object({
  setType: z.enum(["warmup", "normal", "failure", "drop", "pr", "failedpr"]),
  measure: z.enum(["kg", "lbs", "time", "distance", "step"]),
  value: z.string().optional(),
  reps: z.string().optional(),
}); */

// Zod schema for a fitness log entry
export const ExerciseLogSchema = z.object({
  date: z.string(), // ISO 8601 date string
  activity: z.string().min(3).max(100),
  caloriesBurned: z.number().int().optional(),
  notes: z.string().max(500).optional(),
  sets: z.array(SetSchema), // Array of exercise sets
  createdAt: FirestoreTimestampSchema.optional(),
});

export const LabelSchema = z.object({
  label: z.string().min(1).max(50), // Limit emoji length
  description: z.string().min(1).max(100), // Add length constraints
  dates: z.array(z.string().date()).default([]).optional(), // Make dates optional with default empty array
  muscleGroups: z.array(z.string()).default([]).optional(),
  createdAt: FirestoreTimestampSchema.optional(),
});

export const DaySchema = z.object({
  date: z.string().date(),
  labelId: z.string().min(1),
  createdAt: FirestoreTimestampSchema.optional(),
});

export const ProgramExerciseSchema = z.object({
  activity: z.string().min(3).max(100),
  notes: z.string().max(500).optional(),
  sets: z.array(SetSchema),
  createdAt: FirestoreTimestampSchema.optional(),
});

export const ProgramDaySchema = z.object({
  isRestDay: z.boolean(),
  label: LabelSchema.optional(),
  exercises: z.array(ProgramExerciseSchema).optional(),
});

export const ProgramSchema = z.object({
  name: z.string().min(1),
  days: z.array(ProgramDaySchema),
  createdAt: FirestoreTimestampSchema.optional(),
});

export const ExerciseNameListSchema = z.object({
  name: z.string(),
  createdAt: FirestoreTimestampSchema.optional(),
});

export const WeightMeasureSchema = z.enum(["kg", "lbs"]);

export const WeightSchema = z.object({
  weight: z.number(),
  date: z.string(),
  createdAt: FirestoreTimestampSchema.optional(),
});

export const UserSettingsSchema = z.object({
  measure: WeightMeasureSchema,
  activeProgramId: z.string().optional(),
  activeProgramDay: z.number().int().min(0).optional(),
  activeProgramDayDate: z.string().optional(),
});

export const GenderSchema = z.enum([
  "male",
  "female",
  "non_binary",
  "prefer_not_to_say",
]);

export const UserProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  birthday: z.string().date().optional(),
  gender: GenderSchema.optional(),
});

export const ChatRoleSchema = z.enum(["user", "model"]);

export const ChatMessageSchema = z.object({
  role: ChatRoleSchema,
  text: z.string(),
  createdAt: FirestoreTimestampSchema.optional(),
});

export const LabelWithIdSchema = LabelSchema.extend({
  id: z.string(),
});

export const DayWithIdSchema = DaySchema.extend({
  id: z.string(),
});

export const ExerciseLogWithIdSchema = ExerciseLogSchema.extend({
  id: z.string(),
});

export const ExerciseNameListWithIdSchema = ExerciseNameListSchema.extend({
  id: z.string(),
});

export const ProgramWithIdSchema = ProgramSchema.extend({
  id: z.string(),
});

export const WeightWithIdSchema = WeightSchema.extend({
  id: z.string(),
});

export const ChatMessageWithIdSchema = ChatMessageSchema.extend({
  id: z.string(),
});
