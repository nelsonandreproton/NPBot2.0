import express from "express";
import { config } from "./config";
import { logger } from "./utils/logger";
import { adapter } from "./bot/adapter";
import { NPBot } from "./bot/teamsBot";
import { AuthProvider } from "./auth/authProvider";
import { OllamaProvider } from "./llm/ollamaProvider";
import { AgentRuntime } from "./agent/agentRuntime";
import { ToolRegistry } from "./tools/registry";
import { ConversationStore } from "./memory/conversationStore";
import { LongTermMemory } from "./memory/longTermMemory";
import { SkillLoader } from "./skills/skillLoader";
import { MCPManager } from "./tools/mcp/mcpManager";
import { closeDatabase } from "./memory/database";

// Graph tools
import { ReadEmailsTool, SendEmailTool, SearchEmailsTool } from "./tools/graph/email";
import { ListFilesTool, SearchFilesTool, ReadFileTool } from "./tools/graph/files";
import { ListEventsTool, CreateEventTool } from "./tools/graph/calendar";
import {
  ListChatsTool,
  ReadChatMessagesTool,
  ListChannelMessagesTool,
  ListTeamsAndChannelsTool,
} from "./tools/graph/chat";
import { WebSearchTool } from "./tools/search/webSearch";

async function main() {
  logger.info("Starting NPBot...");

  // 1. Initialize tool registry and register built-in tools
  const toolRegistry = new ToolRegistry();

  // Microsoft Graph tools
  toolRegistry.register(new ReadEmailsTool());
  toolRegistry.register(new SendEmailTool());
  toolRegistry.register(new SearchEmailsTool());
  toolRegistry.register(new ListFilesTool());
  toolRegistry.register(new SearchFilesTool());
  toolRegistry.register(new ReadFileTool());
  toolRegistry.register(new ListEventsTool());
  toolRegistry.register(new CreateEventTool());
  toolRegistry.register(new ListChatsTool());
  toolRegistry.register(new ReadChatMessagesTool());
  toolRegistry.register(new ListChannelMessagesTool());
  toolRegistry.register(new ListTeamsAndChannelsTool());

  // Web search
  toolRegistry.register(new WebSearchTool());

  // 2. Load user-defined skills
  const skillLoader = new SkillLoader(toolRegistry);
  skillLoader.loadAllSkills();

  // 3. Connect MCP servers
  const mcpManager = new MCPManager(toolRegistry);
  await mcpManager.loadAndConnect();

  // 4. Initialize LLM provider
  const llm = new OllamaProvider();
  await llm.ensureModel();

  // 5. Initialize agent runtime
  const agent = new AgentRuntime(llm, toolRegistry);

  // 6. Initialize auth and memory
  const authProvider = new AuthProvider();
  const conversationStore = new ConversationStore();
  const memory = new LongTermMemory();

  // 7. Create bot
  const bot = new NPBot(agent, authProvider, conversationStore, memory);

  // 8. Start Express server
  const app = express();
  app.use(express.json());

  // Health check
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      tools: toolRegistry.listTools(),
      skills: skillLoader.getLoadedSkills(),
      mcpServers: mcpManager.getConnectedServers(),
    });
  });

  // Bot Framework messaging endpoint
  app.post("/api/messages", async (req, res) => {
    await adapter.process(req, res, (context) => bot.run(context));
  });

  app.listen(config.port, () => {
    logger.info(
      {
        port: config.port,
        model: config.ollamaModel,
        tools: toolRegistry.listTools().length,
      },
      `NPBot running on http://localhost:${config.port}`,
    );
    logger.info(
      `Bot endpoint: http://localhost:${config.port}/api/messages`,
    );
    logger.info(
      `Health check: http://localhost:${config.port}/health`,
    );
  });

  // Graceful shutdown
  const shutdown = async () => {
    logger.info("Shutting down...");
    await mcpManager.disconnectAll();
    closeDatabase();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  logger.fatal({ err }, "Failed to start NPBot");
  process.exit(1);
});
