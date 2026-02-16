import { Ollama, ChatResponse, Tool as OllamaTool } from "ollama";
import { config } from "../config";
import { logger } from "../utils/logger";
import { LLMError } from "../utils/errors";
import { LLMProvider, ChatMessage, LLMResponse, ToolCall } from "./types";
import { ToolDefinition } from "../tools/types";

export class OllamaProvider implements LLMProvider {
  private client: Ollama;
  private model: string;

  constructor(baseUrl?: string, model?: string) {
    this.client = new Ollama({ host: baseUrl ?? config.ollamaBaseUrl });
    this.model = model ?? config.ollamaModel;
  }

  async chat(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
  ): Promise<LLMResponse> {
    try {
      const ollamaMessages = messages.map((m) => ({
        role: m.role as "system" | "user" | "assistant" | "tool",
        content: m.content,
      }));

      const ollamaTools: OllamaTool[] | undefined = tools?.map((t) => ({
        type: "function" as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));

      const response: ChatResponse = await this.client.chat({
        model: this.model,
        messages: ollamaMessages,
        tools: ollamaTools,
        options: {
          temperature: 0.3,
          num_ctx: 8192,
        },
      });

      const toolCalls = this.extractToolCalls(response);

      return {
        content: response.message.content ?? "",
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        finishReason: toolCalls.length > 0 ? "tool_calls" : "stop",
      };
    } catch (err) {
      logger.error({ err }, "Ollama chat failed");
      throw new LLMError(
        `Ollama request failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private extractToolCalls(response: ChatResponse): ToolCall[] {
    const calls: ToolCall[] = [];
    const toolCalls = response.message.tool_calls;
    if (!toolCalls) return calls;

    for (let i = 0; i < toolCalls.length; i++) {
      const tc = toolCalls[i];
      calls.push({
        id: `call_${Date.now()}_${i}`,
        function: {
          name: tc.function.name,
          arguments: JSON.stringify(tc.function.arguments),
        },
      });
    }
    return calls;
  }

  async ensureModel(): Promise<void> {
    try {
      const models = await this.client.list();
      const installed = models.models.some(
        (m) => m.name === this.model || m.name.startsWith(this.model.split(":")[0]),
      );
      if (!installed) {
        logger.info({ model: this.model }, "Pulling model (first run)...");
        await this.client.pull({ model: this.model });
        logger.info({ model: this.model }, "Model pulled successfully");
      }
    } catch (err) {
      logger.warn(
        { err },
        "Could not verify model — make sure Ollama is running and the model is pulled",
      );
    }
  }
}
