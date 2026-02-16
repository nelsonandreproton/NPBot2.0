import fs from "fs";
import path from "path";
import { SkillManifest, SkillToolDefinition } from "./types";
import { Tool, ToolDefinition, ToolContext, ToolResult } from "../tools/types";
import { ToolRegistry } from "../tools/registry";
import { logger } from "../utils/logger";
import { config } from "../config";

export class SkillLoader {
  private loadedSkills = new Map<string, SkillManifest>();

  constructor(private toolRegistry: ToolRegistry) {}

  loadAllSkills(): void {
    const skillsDir = path.resolve(config.skillsDir);
    if (!fs.existsSync(skillsDir)) {
      logger.info({ skillsDir }, "Skills directory not found, skipping");
      return;
    }

    const files = fs.readdirSync(skillsDir).filter((f) => f.endsWith(".json"));

    for (const file of files) {
      try {
        this.loadSkill(path.join(skillsDir, file));
      } catch (err) {
        logger.error({ err, file }, "Failed to load skill");
      }
    }

    logger.info(
      { count: this.loadedSkills.size },
      "Skills loaded",
    );
  }

  loadSkill(manifestPath: string): void {
    const raw = fs.readFileSync(manifestPath, "utf-8");
    const manifest: SkillManifest = JSON.parse(raw);

    if (!manifest.name || !manifest.tools) {
      throw new Error(`Invalid skill manifest: ${manifestPath}`);
    }

    for (const toolDef of manifest.tools) {
      const tool = this.createToolFromDefinition(manifest.name, toolDef);
      this.toolRegistry.register(tool);
    }

    this.loadedSkills.set(manifest.name, manifest);
    logger.info(
      { skill: manifest.name, tools: manifest.tools.length },
      "Skill loaded",
    );
  }

  private createToolFromDefinition(
    skillName: string,
    def: SkillToolDefinition,
  ): Tool {
    const definition: ToolDefinition = {
      name: def.name,
      description: `[${skillName}] ${def.description}`,
      parameters: def.parameters,
    };

    return {
      definition,
      execute: async (
        args: Record<string, unknown>,
        ctx: ToolContext,
      ): Promise<ToolResult> => {
        if (def.endpoint) {
          return this.executeEndpoint(def, args);
        }
        if (def.script) {
          return this.executeScript(def, args, ctx);
        }
        return {
          success: false,
          error: "Skill tool has no execution method defined",
        };
      },
    };
  }

  private async executeEndpoint(
    def: SkillToolDefinition,
    args: Record<string, unknown>,
  ): Promise<ToolResult> {
    if (!def.endpoint) return { success: false, error: "No endpoint defined" };

    let url = def.endpoint.url;
    let body = def.endpoint.bodyTemplate;

    // Substitute parameters in URL and body
    for (const [key, value] of Object.entries(args)) {
      const placeholder = `{{${key}}}`;
      url = url.replace(placeholder, encodeURIComponent(String(value)));
      if (body) {
        body = body.replace(placeholder, String(value));
      }
    }

    const response = await fetch(url, {
      method: def.endpoint.method,
      headers: {
        "Content-Type": "application/json",
        ...def.endpoint.headers,
      },
      body: body && def.endpoint.method !== "GET" ? body : undefined,
    });

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${await response.text()}`,
      };
    }

    const data = await response.json();
    return { success: true, data };
  }

  private async executeScript(
    def: SkillToolDefinition,
    args: Record<string, unknown>,
    ctx: ToolContext,
  ): Promise<ToolResult> {
    if (!def.script) return { success: false, error: "No script defined" };

    try {
      // Create a sandboxed-ish function from the script
      const fn = new Function("args", "context", def.script);
      const result = await fn(args, ctx);
      return { success: true, data: result };
    } catch (err) {
      return {
        success: false,
        error: `Script error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  getLoadedSkills(): string[] {
    return Array.from(this.loadedSkills.keys());
  }
}
