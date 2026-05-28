import { ThemedView } from "@/components/ThemedView";
import AppTextInput from "@/components/ui/AppTextInput";
import { useState } from "react";

export default function CreateProgramScreen() {
  const [programName, setProgramName] = useState("");
  return (
    <>
      <ThemedView>
        <AppTextInput
          value={programName}
          onChangeText={setProgramName}
          autoFocus={false}
          className="w-full text-3xl font-semibold"
          style={{ textTransform: "uppercase" }}
          placeholder="Exercise name..."
          autoCapitalize="characters"
        />
      </ThemedView>
    </>
  );
}
