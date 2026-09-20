import React, { createContext, useContext } from "react";

const InsideBottomSheetContext = createContext<boolean>(false);

export function InsideBottomSheetProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <InsideBottomSheetContext.Provider value={true}>
      {children}
    </InsideBottomSheetContext.Provider>
  );
}

export function useInsideBottomSheet(): boolean {
  return useContext(InsideBottomSheetContext);
}
