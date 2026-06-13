import { ProgramSchema } from "@/types/types";
import React from "react";
import { z } from "zod";

type Program = z.infer<typeof ProgramSchema>;

interface ActiveProgramContextType {
  activeProgram: Program;
  selectProgram: (programId: string) => void;
  isSelecting: boolean;
  isLoading: boolean;
}

export default function ActiveProgramContext() {
  return <div>ProgramContext</div>;
}
