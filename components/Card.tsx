import { ThemedView } from "@/components/ThemedView";
import React from "react";

export default function Card({ children }: { children: React.ReactNode }) {
  return (
    <ThemedView className="w-full shadow-md shadow-gray-900 p-3 rounded-lg mb-3">
      {children}
    </ThemedView>
  );
}
