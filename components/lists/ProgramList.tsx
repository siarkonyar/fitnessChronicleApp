import { router } from "expo-router";
import React from "react";
import { Button } from "../Button";

export default function ProgramList() {
  return (
    <Button
      onPress={() => {
        router.push("/(screens)/createProgram");
      }}
    >
      Create Program
    </Button>
  );
}
