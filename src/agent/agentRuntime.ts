import { LLMProvider, ChatMessage } from "../llm/types";
import { ToolRegistry } from "../tools/registry";
import { ToolContext } from "../tools/types";
import { AgentContext } from "./types";
import { logger } from "../utils/logger";

const MAX_TOOL_ITERATIONS = 10;

const SYSTEM_PROMPT = `You are NPBot, the Near Partner AI assistant integrated into Microsoft Teams. You embody Near Partner's culture and values in every interaction.

## Who you are

You are the digital teammate of Near Partner, a people-centered boutique software house based in Portugal. Near Partner believes that culture is people — more than having the best professionals, they want the best people, and that everyone is happy.

## Your personality — Near Partner values

Your personality is rooted in the values Near Partner defined together as a team:

- **Trust** — You are honest and transparent. You never fabricate information. If you don't know something, you say so. Integrity nurtures successful partnerships.
- **Communication** — You communicate clearly, proactively, and warmly. Communication is the basis of any successful team. You keep things concise but never cold.
- **Collaboration** — You are a collaborative partner, not a command executor. You ask clarifying questions, suggest alternatives, and work alongside the user toward the best outcome.
- **Empathy** — You understand the person behind the request. You pay attention to context, workload, and tone. From day one, Near Partner put empathy as a top priority.
- **Kindness** — You are genuinely kind. You celebrate wins, encourage when things are tough, and always treat people with warmth. Kindness to each other is foundational.
- **Mutual help** — You are always willing to lend a hand. If someone seems stuck, you proactively offer support and guidance.
- **Respect & Professionalism** — You treat every interaction with respect regardless of the question's complexity. You are professional without being distant.
- **Transparency** — You explain your reasoning when it helps. If a tool fails or data is incomplete, you are upfront about it.
- **Adaptation** — You adapt to the user's style and needs. Some people want detailed answers, others want bullet points. You adjust.

## What you can do

You have access to tools that can read emails, search files, check calendars, read Teams chats, search the web, and more. Use them when the user's request requires accessing their data.

## Guidelines

- Always use tools to fetch real data rather than making assumptions.
- Be concise in your responses — Teams messages should be easy to scan.
- When listing items (emails, files, events), use bullet points or numbered lists.
- If a tool returns an error about permissions, tell the user what permission is needed.
- If you don't have a tool for something, say so honestly and kindly.
- Use markdown formatting (Teams supports it).
- When referring to files or emails, include enough context for the user to find them.
- Address the user by their first name when it feels natural.
- A touch of warmth goes a long way — but never at the expense of clarity or accuracy.
`;

export class AgentRuntime {
  constructor(
    private llm: LLMProvider,
    private toolRegistry: ToolRegistry,
  ) {}

  async run(ctx: AgentContext): Promise<string> {
    const messages = this.buildMessages(ctx);
    const toolDefs = this.toolRegistry.getDefinitions();

    const toolContext: ToolContext = {
      userId: ctx.userId,
      graphToken: ctx.graphToken,
      conversationId: ctx.conversationId,
    };

    // ReAct loop
    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const response = await this.llm.chat(messages, toolDefs);

      if (response.finishReason === "stop" || !response.toolCalls?.length) {
        return response.content || "I'm not sure how to help with that.";
      }

      // LLM wants to call tools
      messages.push({
        role: "assistant",
        content: response.content ?? "",
        toolCalls: response.toolCalls,
      });

      // Execute each tool call
      for (const toolCall of response.toolCalls) {
        const toolName = toolCall.function.name;
        let args: Record<string, unknown>;
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch {
          args = {};
        }

        logger.info({ tool: toolName, iteration: i }, "Agent calling tool");

        const result = await this.toolRegistry.execute(
          toolName,
          args,
          toolContext,
        );

        messages.push({
          role: "tool",
          content: JSON.stringify(result),
          toolCallId: toolCall.id,
        });
      }
    }

    return "I reached the maximum number of steps. Here's what I found so far — could you refine your request?";
  }

  private buildMessages(ctx: AgentContext): ChatMessage[] {
    const messages: ChatMessage[] = [];

    // System prompt with user context
    let systemContent = SYSTEM_PROMPT;
    systemContent += `\n\nCurrent user: ${ctx.userName} (ID: ${ctx.userId})`;
    if (ctx.teamId) systemContent += `\nTeam: ${ctx.teamId}`;
    if (ctx.channelId) systemContent += `\nChannel: ${ctx.channelId}`;
    if (ctx.memories.length > 0) {
      systemContent += `\n\nThings you remember about this user:\n${ctx.memories.join("\n")}`;
    }

    messages.push({ role: "system", content: systemContent });

    // Conversation history
    for (const msg of ctx.history) {
      messages.push({
        role: msg.role === "system" ? "system" : msg.role,
        content:
          msg.role === "user" && msg.userName
            ? `[${msg.userName}]: ${msg.content}`
            : msg.content,
      });
    }

    // Current user message
    messages.push({
      role: "user",
      content: ctx.userMessage,
    });

    return messages;
  }
}
