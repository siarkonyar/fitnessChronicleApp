import { Colors } from "@/constants/Colors";
import { ExerciseLogWithIdSchema } from "@/types/types";
import { Text, View, useColorScheme } from "react-native";
import { z } from "zod";

type ExerciseLog = z.infer<typeof ExerciseLogWithIdSchema>;
type Set = ExerciseLog["sets"][number];

type ShareExerciseCardProps = {
  exercise: ExerciseLog;
};

function getSetLabel(set: Set, normalCountUpToHere: number): string {
  switch (set.setType) {
    case "warmup": return "W";
    case "failure": return "F";
    case "drop": return "D";
    case "pr": return "PR";
    case "failedpr": return "FPR";
    default: return `${normalCountUpToHere}`;
  }
}

function getSetLabelColor(set: Set, palette: (typeof Colors)["light"]) {
  switch (set.setType) {
    case "warmup": return palette.secondary;
    case "failure": return palette.highlight;
    case "drop": return palette.accentBlue;
    case "pr": return palette.success;
    case "failedpr": return palette.danger;
    default: return palette.mutedText;
  }
}

function formatSetValue(set: Set): string {
  if (set.measure === "kg" || set.measure === "lbs") {
    const reps = "reps" in set ? (set.reps ?? "?") : "?";
    return `${set.value ?? "?"}${set.measure} × ${reps}`;
  }
  return set.value ?? "?";
}

export default function ShareExerciseCard({ exercise }: ShareExerciseCardProps) {
  const theme = useColorScheme() ?? "light";
  const palette = Colors[theme];
  let normalCount = 0;

  return (
    <View className="mb-4">
      <View
        className="flex-row items-center mb-2"
        style={{
          borderLeftWidth: 2,
          borderLeftColor: palette.highlight,
          paddingLeft: 8,
        }}
      >
        <Text
          className="text-sm font-bold tracking-widest"
          style={{ color: palette.text }}
        >
          {exercise.activity.toUpperCase()}
        </Text>
      </View>

      <View className="gap-1 pl-1">
        {exercise.sets.map((set, setIndex) => {
          if (set.setType === "normal") normalCount++;
          const label = getSetLabel(set, normalCount);
          const labelColor = getSetLabelColor(set, palette);
          return (
            <View key={setIndex} className="flex-row items-center gap-2">
              <View
                className="w-7 h-5 rounded items-center justify-center"
                style={{ backgroundColor: `${labelColor}22` }}
              >
                <Text
                  className="text-xs font-semibold"
                  style={{ color: labelColor }}
                >
                  {label}
                </Text>
              </View>
              <Text className="text-xs" style={{ color: palette.text }}>
                {formatSetValue(set)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
