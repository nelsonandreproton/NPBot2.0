import { Tool, ToolDefinition, ToolContext, ToolResult } from "./types";
import { logger } from "../utils/logger";

export class ToolRegistry {
  private tools = new Map<string, Tool>();

  register(tool: Tool): void {
    if (this.tools.has(tool.definition.name)) {
      logger.warn(
        { tool: tool.definition.name },
        "Overwriting existing tool registration",
      );
    }
    this.tools.set(tool.definition.name, tool);
    logger.info({ tool: tool.definition.name }, "Tool registered");
  }

  unregister(name: string): void {
    this.tools.delete(name);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((t) => t.definition);
  }

  async execute(
    name: string,
    args: Record<string, unknown>,
    context: ToolContext,
  ): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { success: false, error: `Unknown tool: ${name}` };
    }

    try {
      logger.info({ tool: name, args }, "Executing tool");
      const result = await tool.execute(args, context);
      logger.info({ tool: name, success: result.success }, "Tool execution complete");
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ tool: name, err }, "Tool execution error");
      return { success: false, error: message };
    }
  }

  listTools(): string[] {
    return Array.from(this.tools.keys());
  }
}
