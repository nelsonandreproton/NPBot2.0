import { Tool } from "../tools/types";

export interface SkillManifest {
  name: string;
  version: string;
  description: string;
  author?: string;
  tools: SkillToolDefinition[];
}

export interface SkillToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, any>;
    required: string[];
  };
  /** Shell command to execute. Use {{param}} for parameter substitution. */
  command?: string;
  /** HTTP endpoint to call. */
  endpoint?: {
    url: string;
    method: "GET" | "POST" | "PUT" | "DELETE";
    headers?: Record<string, string>;
    bodyTemplate?: string;
  };
  /** Inline JavaScript function body (receives args, context). */
  script?: string;
}

export type SkillExecutionType = "command" | "endpoint" | "script";
