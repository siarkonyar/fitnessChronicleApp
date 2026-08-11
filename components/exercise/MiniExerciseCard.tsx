import { Colors } from "@/constants/Colors";
import { ExerciseLogSchema } from "@/types/types";
import { Text, View, useColorScheme } from "react-native";
import { z } from "zod";

type ExerciseLog = z.infer<typeof ExerciseLogSchema>;
type Set = ExerciseLog["sets"][number];

type MiniExerciseCardVariant = "share" | "program";

type MiniExerciseCardProps = {
  exercise: Pick<ExerciseLog, "activity" | "sets">;
  variant?: MiniExerciseCardVariant;
  className?: string;
};

function getSetLabel(set: Set, normalCountUpToHere: number): string {
  switch (set.setType) {
    case "warmup":
      return "W";
    case "failure":
      return "F";
    case "drop":
      return "D";
    case "pr":
      return "PR";
    case "failedpr":
      return "FPR";
    default:
      return `${normalCountUpToHere}`;
  }
}

function getSetLabelColor(set: Set, palette: (typeof Colors)["light"]) {
  switch (set.setType) {
    case "warmup":
      return palette.secondary;
    case "failure":
      return palette.highlight;
    case "drop":
      return palette.accentBlue;
    case "pr":
      return palette.success;
    case "failedpr":
      return palette.danger;
    default:
      return palette.mutedText;
  }
}

function formatSetValue(set: Set, variant: MiniExerciseCardVariant): string {
  const reps = "reps" in set ? (set.reps ?? "?") : "?";
  if (variant === "program") return reps;
  if (set.measure === "kg" || set.measure === "lbs") {
    return `${set.value ?? "?"}${set.measure} × ${reps}`;
  }
  return set.value ?? "?";
}

export default function MiniExerciseCard({
  exercise,
  variant = "share",
  className,
}: MiniExerciseCardProps) {
  const theme = useColorScheme() ?? "light";
  const palette = Colors[theme];
  let normalCount = 0;
  const isCompact = variant !== "share";
  const titleSize = isCompact ? "text-base" : "text-sm";
  const setTextSize = isCompact ? "text-sm" : "text-xs";

  return (
    <View className={`mb-4 ${className ?? ""}`}>
      <View
        className="flex-row items-center mb-2"
        style={{
          borderLeftWidth: 2,
          borderLeftColor: palette.highlight,
          paddingLeft: 8,
        }}
      >
        <Text
          className={`${titleSize} font-bold tracking-widest`}
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
                  className={`${setTextSize} font-semibold`}
                  style={{ color: labelColor }}
                >
                  {label}
                </Text>
              </View>
              {/* TODO make the sets text dynamic if it is only one set it should write set instead of sets */}
              <Text className={setTextSize} style={{ color: palette.text }}>
                {formatSetValue(set, variant)} reps
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
