import { useActiveProgram } from "@/hooks/useActiveProgram";
import { ProgramWithIdSchema } from "@/types/types";
import React, { createContext, useContext } from "react";
import { z } from "zod";

type ProgramWithId = z.infer<typeof ProgramWithIdSchema>;

interface ActiveProgramContextType {
  activeProgram: ProgramWithId | undefined;
  programDay: number | undefined;
  selectProgram: (programId: string) => void;
  isSelecting: boolean;
  isLoading: boolean;
}

const ActiveProgramContext = createContext<
  ActiveProgramContextType | undefined
>(undefined);

export function ActiveProgramProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { activeProgram, programDay, selectProgram, isSelecting, isLoading } =
    useActiveProgram();

  const value: ActiveProgramContextType = {
    activeProgram,
    programDay,
    selectProgram,
    isSelecting,
    isLoading,
  };

  return (
    <ActiveProgramContext.Provider value={value}>
      {children}
    </ActiveProgramContext.Provider>
  );
}

export function useActiveProgramContext() {
  const context = useContext(ActiveProgramContext);

  if (context === undefined) {
    throw new Error(
      "useActiveProgramContext must be used within an ActiveProgramProvider",
    );
  }

  return context;
}
