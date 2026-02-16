import "dotenv/config";

export const config = {
  // Azure Bot
  microsoftAppId: process.env.MICROSOFT_APP_ID ?? "",
  microsoftAppPassword: process.env.MICROSOFT_APP_PASSWORD ?? "",
  microsoftAppTenantId: process.env.MICROSOFT_APP_TENANT_ID ?? "",
  oauthConnectionName: process.env.OAUTH_CONNECTION_NAME ?? "GraphConnection",

  // Ollama
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
  ollamaModel: process.env.OLLAMA_MODEL ?? "qwen2.5:14b",

  // Server
  port: parseInt(process.env.PORT ?? "3978", 10),

  // Search
  searxngUrl: process.env.SEARXNG_URL ?? "",

  // Logging
  logLevel: process.env.LOG_LEVEL ?? "info",

  // Paths
  dataDir: process.env.DATA_DIR ?? ".data",
  skillsDir: process.env.SKILLS_DIR ?? "skills",
  mcpConfigPath: process.env.MCP_CONFIG_PATH ?? "config/mcp-servers.json",
} as const;
