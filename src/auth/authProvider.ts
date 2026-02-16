import {
  TurnContext,
  ConversationState,
  MemoryStorage,
  UserState,
} from "botbuilder";
import type { UserTokenClient } from "botframework-connector";
import { config } from "../config";
import { logger } from "../utils/logger";
import { TokenCache } from "./tokenCache";

const OAUTH_PROMPT = "OAuthPrompt";
const DIALOG_ID = "AuthDialog";

export class AuthProvider {
  private tokenCache = new TokenCache();
  private conversationState: ConversationState;
  private userState: UserState;

  constructor() {
    const storage = new MemoryStorage();
    this.conversationState = new ConversationState(storage);
    this.userState = new UserState(storage);
  }

  async getTokenForUser(
    context: TurnContext,
    userId: string,
  ): Promise<string | undefined> {
    // Check cache first
    const cached = this.tokenCache.get(userId);
    if (cached) return cached;

    // Try to get token silently from Bot Framework token store
    try {
      const tokenClient = context.turnState.get<UserTokenClient>(
        (context.adapter as any).UserTokenClientKey ?? "UserTokenClient",
      );
      if (tokenClient) {
        const tokenResponse = await tokenClient.getUserToken(
          userId,
          config.oauthConnectionName,
          context.activity.channelId,
          "",
        );
        if (tokenResponse?.token) {
          this.tokenCache.set(userId, tokenResponse.token, 3600);
          return tokenResponse.token;
        }
      }
    } catch (err) {
      logger.debug({ err }, "Silent token acquisition failed");
    }

    return undefined;
  }

  async promptSignIn(context: TurnContext): Promise<string | undefined> {
    // Send OAuth card to prompt user sign-in
    const oauthCard = {
      contentType: "application/vnd.microsoft.card.oauth",
      content: {
        connectionName: config.oauthConnectionName,
        text: "Sign in to access your Microsoft 365 data",
        title: "Sign In",
      },
    };

    await context.sendActivity({
      attachments: [oauthCard],
    });

    return undefined;
  }

  async handleSignInComplete(
    context: TurnContext,
    userId: string,
  ): Promise<void> {
    try {
      const tokenClient = context.turnState.get<UserTokenClient>(
        (context.adapter as any).UserTokenClientKey ?? "UserTokenClient",
      );
      if (tokenClient) {
        const tokenResponse = await tokenClient.getUserToken(
          userId,
          config.oauthConnectionName,
          context.activity.channelId,
          "",
        );
        if (tokenResponse?.token) {
          this.tokenCache.set(userId, tokenResponse.token, 3600);
          logger.info({ userId }, "User signed in successfully");
        }
      }
    } catch (err) {
      logger.error({ err, userId }, "Failed to handle sign-in completion");
    }
  }

  async handleTokenExchange(
    context: TurnContext,
    userId: string,
  ): Promise<void> {
    const value = context.activity.value;
    if (!value?.token) return;

    try {
      const tokenClient = context.turnState.get<UserTokenClient>(
        (context.adapter as any).UserTokenClientKey ?? "UserTokenClient",
      );
      if (tokenClient) {
        const tokenResponse = await tokenClient.exchangeToken(
          userId,
          config.oauthConnectionName,
          context.activity.channelId,
          { token: value.token },
        );
        if (tokenResponse?.token) {
          this.tokenCache.set(userId, tokenResponse.token, 3600);
          logger.info({ userId }, "Token exchange successful");
        }
      }
    } catch (err) {
      logger.error({ err, userId }, "Token exchange failed");
    }
  }

  invalidateUser(userId: string): void {
    this.tokenCache.delete(userId);
  }
}
