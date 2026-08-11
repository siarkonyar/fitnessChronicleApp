import { useChatBox } from "@/hooks/useChatBox";
import React, { createContext, useContext } from "react";
type ChatContextType = ReturnType<typeof useChatBox>;

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { messages, sendMessage, isSending, clearChat } = useChatBox();

  const value: ChatContextType = {
    messages,
    sendMessage,
    isSending,
    clearChat,
  };
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChatContext() {
  const context = useContext(ChatContext);

  if (context === undefined) {
    throw new Error("ChatContext must be used within an ChatProvider");
  }

  return context;
}
