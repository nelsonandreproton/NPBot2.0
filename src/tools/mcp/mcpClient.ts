import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Tool, ToolDefinition, ToolContext, ToolResult } from "../types";
import { logger } from "../../utils/logger";

export interface MCPServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export class MCPClientWrapper {
  private client: Client;
  private transport: StdioClientTransport;
  private connected = false;

  constructor(
    private serverName: string,
    private serverConfig: MCPServerConfig,
  ) {
    this.transport = new StdioClientTransport({
      command: serverConfig.command,
      args: serverConfig.args,
      env: { ...process.env, ...serverConfig.env } as Record<string, string>,
    });

    this.client = new Client(
      { name: "npbot", version: "1.0.0" },
      { capabilities: {} },
    );
  }

  async connect(): Promise<void> {
    if (this.connected) return;

    try {
      await this.client.connect(this.transport);
      this.connected = true;
      logger.info({ server: this.serverName }, "MCP server connected");
    } catch (err) {
      logger.error({ err, server: this.serverName }, "MCP server connection failed");
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return;
    await this.client.close();
    this.connected = false;
  }

  async listTools(): Promise<Tool[]> {
    if (!this.connected) await this.connect();

    const response = await this.client.listTools();
    return response.tools.map((mcpTool) => this.wrapTool(mcpTool));
  }

  private wrapTool(mcpTool: any): Tool {
    const definition: ToolDefinition = {
      name: `mcp_${this.serverName}_${mcpTool.name}`,
      description: `[MCP:${this.serverName}] ${mcpTool.description ?? mcpTool.name}`,
      parameters: mcpTool.inputSchema ?? {
        type: "object",
        properties: {},
        required: [],
      },
    };

    return {
      definition,
      execute: async (
        args: Record<string, unknown>,
        _ctx: ToolContext,
      ): Promise<ToolResult> => {
        try {
          const result = await this.client.callTool({
            name: mcpTool.name,
            arguments: args,
          });

          // MCP returns content array
          const textContent = (result.content as any[])
            ?.filter((c: any) => c.type === "text")
            .map((c: any) => c.text)
            .join("\n");

          return {
            success: !result.isError,
            data: textContent || result.content,
            error: result.isError ? textContent : undefined,
          };
        } catch (err) {
          return {
            success: false,
            error: `MCP tool error: ${err instanceof Error ? err.message : String(err)}`,
          };
        }
      },
    };
  }
}
