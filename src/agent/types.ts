import { ChatMessage } from "../llm/types";

export interface AgentContext {
  userMessage: string;
  userId: string;
  userName: string;
  graphToken?: string;
  conversationId: string;
  teamId?: string;
  channelId?: string;
  history: StoredMessage[];
  memories: string[];
  sendActivity: (text: string) => Promise<void>;
}

export interface StoredMessage {
  role: "user" | "assistant" | "system";
  content: string;
  userId?: string;
  userName?: string;
  timestamp: string;
}
