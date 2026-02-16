import fs from "fs";
import path from "path";
import { MCPClientWrapper, MCPServerConfig } from "./mcpClient";
import { ToolRegistry } from "../registry";
import { config } from "../../config";
import { logger } from "../../utils/logger";

interface MCPConfig {
  servers: Record<string, MCPServerConfig>;
}

export class MCPManager {
  private clients = new Map<string, MCPClientWrapper>();

  constructor(private toolRegistry: ToolRegistry) {}

  async loadAndConnect(): Promise<void> {
    const configPath = path.resolve(config.mcpConfigPath);
    if (!fs.existsSync(configPath)) {
      logger.info("No MCP config found, skipping");
      return;
    }

    const raw = fs.readFileSync(configPath, "utf-8");
    const mcpConfig: MCPConfig = JSON.parse(raw);

    for (const [name, serverConfig] of Object.entries(mcpConfig.servers)) {
      try {
        await this.connectServer(name, serverConfig);
      } catch (err) {
        logger.error({ err, server: name }, "Failed to connect MCP server");
      }
    }
  }

  async connectServer(name: string, serverConfig: MCPServerConfig): Promise<void> {
    const client = new MCPClientWrapper(name, serverConfig);
    await client.connect();

    const tools = await client.listTools();
    for (const tool of tools) {
      this.toolRegistry.register(tool);
    }

    this.clients.set(name, client);
    logger.info({ server: name, tools: tools.length }, "MCP server tools registered");
  }

  async disconnectAll(): Promise<void> {
    for (const [name, client] of this.clients) {
      try {
        await client.disconnect();
        logger.info({ server: name }, "MCP server disconnected");
      } catch (err) {
        logger.error({ err, server: name }, "Error disconnecting MCP server");
      }
    }
    this.clients.clear();
  }

  getConnectedServers(): string[] {
    return Array.from(this.clients.keys());
  }
}
