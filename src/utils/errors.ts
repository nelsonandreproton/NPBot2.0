export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class AuthError extends AppError {
  constructor(message: string) {
    super(message, "AUTH_ERROR", 401);
    this.name = "AuthError";
  }
}

export class LLMError extends AppError {
  constructor(message: string) {
    super(message, "LLM_ERROR", 502);
    this.name = "LLMError";
  }
}

export class ToolError extends AppError {
  constructor(message: string, public readonly toolName: string) {
    super(message, "TOOL_ERROR", 500);
    this.name = "ToolError";
  }
}
