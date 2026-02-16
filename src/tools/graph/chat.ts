import { Tool, ToolDefinition, ToolContext, ToolResult } from "../types";
import { createGraphClient } from "./graphClient";

export class ListChatsTool implements Tool {
  definition: ToolDefinition = {
    name: "list_chats",
    description:
      "List the user's recent Teams chats (1:1, group chats, and meeting chats).",
    parameters: {
      type: "object",
      properties: {
        count: {
          type: "string",
          description: "Number of chats to return (default 15, max 50)",
        },
      },
      required: [],
    },
  };

  async execute(
    args: Record<string, unknown>,
    ctx: ToolContext,
  ): Promise<ToolResult> {
    if (!ctx.graphToken)
      return { success: false, error: "Not authenticated — please sign in" };

    const client = createGraphClient(ctx.graphToken);
    const count = Math.min(parseInt(String(args.count ?? "15"), 10), 50);

    const response = await client
      .api("/me/chats")
      .top(count)
      .select("id,topic,chatType,lastUpdatedDateTime")
      .expand("members($select=displayName,email)")
      .orderby("lastUpdatedDateTime DESC")
      .get();

    const chats = response.value.map((chat: any) => ({
      id: chat.id,
      topic: chat.topic || "(no topic)",
      type: chat.chatType,
      lastUpdated: chat.lastUpdatedDateTime,
      members: chat.members?.map((m: any) => m.displayName) ?? [],
    }));

    return { success: true, data: chats };
  }
}

export class ReadChatMessagesTool implements Tool {
  definition: ToolDefinition = {
    name: "read_chat_messages",
    description:
      "Read recent messages from a specific Teams chat. Use list_chats first to get the chat ID.",
    parameters: {
      type: "object",
      properties: {
        chatId: {
          type: "string",
          description: "The chat ID (from list_chats)",
        },
        count: {
          type: "string",
          description: "Number of messages to return (default 20, max 50)",
        },
      },
      required: ["chatId"],
    },
  };

  async execute(
    args: Record<string, unknown>,
    ctx: ToolContext,
  ): Promise<ToolResult> {
    if (!ctx.graphToken)
      return { success: false, error: "Not authenticated — please sign in" };

    const client = createGraphClient(ctx.graphToken);
    const count = Math.min(parseInt(String(args.count ?? "20"), 10), 50);

    const response = await client
      .api(`/me/chats/${String(args.chatId)}/messages`)
      .top(count)
      .select("id,body,from,createdDateTime,messageType")
      .orderby("createdDateTime DESC")
      .get();

    const messages = response.value
      .filter((m: any) => m.messageType === "message")
      .map((msg: any) => ({
        from: msg.from?.user?.displayName ?? "Unknown",
        content: msg.body?.content?.replace(/<[^>]*>/g, "") ?? "",
        date: msg.createdDateTime,
      }));

    return { success: true, data: messages };
  }
}

export class ListChannelMessagesTool implements Tool {
  definition: ToolDefinition = {
    name: "list_channel_messages",
    description:
      "Read recent messages from a Teams channel. Requires the team ID and channel ID.",
    parameters: {
      type: "object",
      properties: {
        teamId: {
          type: "string",
          description: "The team ID",
        },
        channelId: {
          type: "string",
          description: "The channel ID",
        },
        count: {
          type: "string",
          description: "Number of messages to return (default 20, max 50)",
        },
      },
      required: ["teamId", "channelId"],
    },
  };

  async execute(
    args: Record<string, unknown>,
    ctx: ToolContext,
  ): Promise<ToolResult> {
    if (!ctx.graphToken)
      return { success: false, error: "Not authenticated — please sign in" };

    const client = createGraphClient(ctx.graphToken);
    const count = Math.min(parseInt(String(args.count ?? "20"), 10), 50);

    const response = await client
      .api(
        `/teams/${String(args.teamId)}/channels/${String(args.channelId)}/messages`,
      )
      .top(count)
      .get();

    const messages = response.value
      .filter((m: any) => m.messageType === "message")
      .map((msg: any) => ({
        from: msg.from?.user?.displayName ?? "Unknown",
        content: msg.body?.content?.replace(/<[^>]*>/g, "") ?? "",
        date: msg.createdDateTime,
      }));

    return { success: true, data: messages };
  }
}

export class ListTeamsAndChannelsTool implements Tool {
  definition: ToolDefinition = {
    name: "list_teams_and_channels",
    description:
      "List the Teams the user belongs to and their channels.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  };

  async execute(
    _args: Record<string, unknown>,
    ctx: ToolContext,
  ): Promise<ToolResult> {
    if (!ctx.graphToken)
      return { success: false, error: "Not authenticated — please sign in" };

    const client = createGraphClient(ctx.graphToken);

    const teamsResponse = await client
      .api("/me/joinedTeams")
      .select("id,displayName,description")
      .get();

    const teams = [];
    for (const team of teamsResponse.value) {
      const channelsResponse = await client
        .api(`/teams/${team.id}/channels`)
        .select("id,displayName,description")
        .get();

      teams.push({
        id: team.id,
        name: team.displayName,
        description: team.description,
        channels: channelsResponse.value.map((ch: any) => ({
          id: ch.id,
          name: ch.displayName,
        })),
      });
    }

    return { success: true, data: teams };
  }
}
