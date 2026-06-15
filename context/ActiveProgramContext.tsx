import { useActiveProgram } from "@/hooks/useActiveProgram";
import React, { createContext, useContext } from "react";

type ActiveProgramContextType = ReturnType<typeof useActiveProgram>;

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
