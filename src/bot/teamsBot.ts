import {
  TeamsActivityHandler,
  TurnContext,
  MessageFactory,
  TokenResponse,
  teamsGetTeamId,
  teamsGetChannelId,
} from "botbuilder";
import { config } from "../config";
import { logger } from "../utils/logger";
import { AgentRuntime } from "../agent/agentRuntime";
import { AuthProvider } from "../auth/authProvider";
import { ConversationStore } from "../memory/conversationStore";
import { LongTermMemory } from "../memory/longTermMemory";

export class NPBot extends TeamsActivityHandler {
  private agent: AgentRuntime;
  private authProvider: AuthProvider;
  private conversationStore: ConversationStore;
  private memory: LongTermMemory;

  constructor(
    agent: AgentRuntime,
    authProvider: AuthProvider,
    conversationStore: ConversationStore,
    memory: LongTermMemory,
  ) {
    super();
    this.agent = agent;
    this.authProvider = authProvider;
    this.conversationStore = conversationStore;
    this.memory = memory;

    this.onMessage(async (context, next) => {
      await this.handleMessage(context);
      await next();
    });

    this.onMembersAdded(async (context, next) => {
      for (const member of context.activity.membersAdded ?? []) {
        if (member.id !== context.activity.recipient.id) {
          await context.sendActivity(
            "Hello! I'm your AI assistant. I can help you with emails, files, calendar, and Teams chats. " +
            "Type anything to get started — I'll ask you to sign in on first use.",
          );
        }
      }
      await next();
    });
  }

  private async handleMessage(context: TurnContext): Promise<void> {
    const userId = context.activity.from.aadObjectId ?? context.activity.from.id;
    const userName = context.activity.from.name ?? "User";
    const text = context.activity.text?.trim() ?? "";
    const conversationId = context.activity.conversation.id;

    if (!text) return;

    logger.info({ userId, userName, text: text.substring(0, 100) }, "Incoming message");

    // Strip bot mention from channel messages
    const cleanText = this.stripMention(context, text);

    // Try to get Graph token for the user
    let graphToken: string | undefined;
    try {
      graphToken = await this.authProvider.getTokenForUser(context, userId);
    } catch {
      // Token not available — user needs to sign in
    }

    if (!graphToken) {
      // Trigger OAuth sign-in
      const signInResult = await this.authProvider.promptSignIn(context);
      if (!signInResult) {
        return; // OAuth card sent, waiting for user to sign in
      }
      graphToken = signInResult;
    }

    // Build conversation context
    const teamId = this.getTeamId(context);
    const channelId = this.getChannelId(context);

    const history = this.conversationStore.getHistory(conversationId, 20);
    const memories = this.memory.recall(userId, cleanText);

    // Store the user message
    this.conversationStore.addMessage(conversationId, {
      role: "user",
      content: cleanText,
      userId,
      userName,
      timestamp: new Date().toISOString(),
    });

    // Send typing indicator
    await context.sendActivity({ type: "typing" });

    // Run the agent
    try {
      const response = await this.agent.run({
        userMessage: cleanText,
        userId,
        userName,
        graphToken,
        conversationId,
        teamId,
        channelId,
        history,
        memories,
        sendActivity: async (text: string) => {
          await context.sendActivity(MessageFactory.text(text));
        },
      });

      // Send the final response
      await context.sendActivity(MessageFactory.text(response));

      // Store assistant response
      this.conversationStore.addMessage(conversationId, {
        role: "assistant",
        content: response,
        timestamp: new Date().toISOString(),
      });

      // Extract and store any memories
      this.memory.extractAndStore(userId, cleanText, response);
    } catch (err) {
      logger.error({ err }, "Agent runtime error");
      await context.sendActivity(
        "I encountered an error processing your request. Please try again.",
      );
    }
  }

  protected async handleTeamsSigninVerifyState(
    context: TurnContext,
  ): Promise<void> {
    // Called when user completes OAuth sign-in
    const userId = context.activity.from.aadObjectId ?? context.activity.from.id;
    logger.info({ userId }, "Sign-in verification received");
    await this.authProvider.handleSignInComplete(context, userId);
    await context.sendActivity(
      "You're signed in! You can now ask me anything about your emails, files, calendar, or chats.",
    );
  }

  protected async handleTeamsSigninTokenExchange(
    context: TurnContext,
  ): Promise<void> {
    const userId = context.activity.from.aadObjectId ?? context.activity.from.id;
    await this.authProvider.handleTokenExchange(context, userId);
  }

  private stripMention(context: TurnContext, text: string): string {
    const mentions = TurnContext.getMentions(context.activity);
    let cleaned = text;
    for (const mention of mentions) {
      if (mention.mentioned.id === context.activity.recipient.id) {
        cleaned = cleaned.replace(mention.text, "").trim();
      }
    }
    return cleaned;
  }

  private getTeamId(context: TurnContext): string | undefined {
    try {
      return teamsGetTeamId(context.activity) ?? undefined;
    } catch {
      return undefined;
    }
  }

  private getChannelId(context: TurnContext): string | undefined {
    try {
      return teamsGetChannelId(context.activity) ?? undefined;
    } catch {
      return undefined;
    }
  }
}
