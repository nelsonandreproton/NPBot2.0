import { Tool, ToolDefinition, ToolContext, ToolResult } from "../types";
import { createGraphClient } from "./graphClient";

export class ListFilesTool implements Tool {
  definition: ToolDefinition = {
    name: "list_files",
    description:
      "List files in the user's OneDrive root or a specific folder. Returns file names, sizes, and last modified dates.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description:
            'Folder path in OneDrive (e.g. "/Documents", "/Projects/Q4"). Defaults to root.',
        },
        count: {
          type: "string",
          description: "Number of items to return (default 20, max 50)",
        },
      },
      required: [],
    },
  };

  async execute(
    args: Record<string, unknown>,
    ctx: ToolContext,
  ): Promise<ToolResult> {
    if (!ctx.graphToken)
      return { success: false, error: "Not authenticated — please sign in" };

    const client = createGraphClient(ctx.graphToken);
    const count = Math.min(parseInt(String(args.count ?? "20"), 10), 50);
    const path = args.path ? String(args.path) : "";

    const endpoint = path
      ? `/me/drive/root:${path}:/children`
      : "/me/drive/root/children";

    const response = await client
      .api(endpoint)
      .top(count)
      .select("name,size,lastModifiedDateTime,file,folder,webUrl")
      .get();

    const files = response.value.map((item: any) => ({
      name: item.name,
      type: item.folder ? "folder" : "file",
      size: item.size,
      lastModified: item.lastModifiedDateTime,
      mimeType: item.file?.mimeType,
      webUrl: item.webUrl,
    }));

    return { success: true, data: files };
  }
}

export class SearchFilesTool implements Tool {
  definition: ToolDefinition = {
    name: "search_files",
    description:
      "Search for files across OneDrive and SharePoint by name or content.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query (file name or content keywords)",
        },
        count: {
          type: "string",
          description: "Number of results (default 10, max 25)",
        },
      },
      required: ["query"],
    },
  };

  async execute(
    args: Record<string, unknown>,
    ctx: ToolContext,
  ): Promise<ToolResult> {
    if (!ctx.graphToken)
      return { success: false, error: "Not authenticated — please sign in" };

    const client = createGraphClient(ctx.graphToken);
    const count = Math.min(parseInt(String(args.count ?? "10"), 10), 25);

    const response = await client
      .api(`/me/drive/root/search(q='${String(args.query)}')`)
      .top(count)
      .select("name,size,lastModifiedDateTime,webUrl,parentReference")
      .get();

    const files = response.value.map((item: any) => ({
      name: item.name,
      size: item.size,
      lastModified: item.lastModifiedDateTime,
      webUrl: item.webUrl,
      location: item.parentReference?.path,
    }));

    return { success: true, data: files };
  }
}

export class ReadFileTool implements Tool {
  definition: ToolDefinition = {
    name: "read_file",
    description:
      "Read the text content of a file from OneDrive (supports .txt, .md, .csv, .json, etc.). For Office docs, returns a preview.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: 'File path in OneDrive (e.g. "/Documents/report.txt")',
        },
      },
      required: ["path"],
    },
  };

  async execute(
    args: Record<string, unknown>,
    ctx: ToolContext,
  ): Promise<ToolResult> {
    if (!ctx.graphToken)
      return { success: false, error: "Not authenticated — please sign in" };

    const client = createGraphClient(ctx.graphToken);
    const path = String(args.path);

    try {
      // Try to get content directly (works for text files)
      const stream = await client
        .api(`/me/drive/root:${path}:/content`)
        .getStream();

      const chunks: Buffer[] = [];
      for await (const chunk of stream as any) {
        chunks.push(Buffer.from(chunk));
      }
      const content = Buffer.concat(chunks).toString("utf-8");

      // Truncate if too long
      const maxLength = 8000;
      const truncated = content.length > maxLength;
      return {
        success: true,
        data: {
          content: truncated ? content.substring(0, maxLength) : content,
          truncated,
          totalLength: content.length,
        },
      };
    } catch {
      return {
        success: false,
        error: "Could not read file content. The file may be a binary format (use search_files to find it and provide the webUrl instead).",
      };
    }
  }
}
