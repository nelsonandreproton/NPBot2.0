import { Tool, ToolDefinition, ToolContext, ToolResult } from "../types";
import { createGraphClient } from "./graphClient";

export class ReadEmailsTool implements Tool {
  definition: ToolDefinition = {
    name: "read_emails",
    description:
      "Read the user's recent emails from Outlook. Can filter by sender, subject, or unread status.",
    parameters: {
      type: "object",
      properties: {
        count: {
          type: "string",
          description: "Number of emails to return (default 10, max 50)",
        },
        filter: {
          type: "string",
          description:
            'OData filter, e.g. "isRead eq false" or "from/emailAddress/address eq \'someone@example.com\'"',
        },
        search: {
          type: "string",
          description: "Search query to find emails by subject or body content",
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
    const count = Math.min(parseInt(String(args.count ?? "10"), 10), 50);

    let request = client
      .api("/me/messages")
      .top(count)
      .select("subject,from,receivedDateTime,isRead,bodyPreview")
      .orderby("receivedDateTime DESC");

    if (args.filter) request = request.filter(String(args.filter));
    if (args.search) request = request.search(String(args.search));

    const response = await request.get();
    const emails = response.value.map((email: any) => ({
      subject: email.subject,
      from: email.from?.emailAddress?.name ?? email.from?.emailAddress?.address,
      date: email.receivedDateTime,
      isRead: email.isRead,
      preview: email.bodyPreview?.substring(0, 200),
    }));

    return { success: true, data: emails };
  }
}

export class SendEmailTool implements Tool {
  definition: ToolDefinition = {
    name: "send_email",
    description: "Send an email on behalf of the user via Outlook.",
    parameters: {
      type: "object",
      properties: {
        to: {
          type: "string",
          description: "Recipient email address",
        },
        subject: {
          type: "string",
          description: "Email subject line",
        },
        body: {
          type: "string",
          description: "Email body content (plain text or HTML)",
        },
        isHtml: {
          type: "string",
          description: "Whether the body is HTML (true/false, default false)",
        },
      },
      required: ["to", "subject", "body"],
    },
  };

  async execute(
    args: Record<string, unknown>,
    ctx: ToolContext,
  ): Promise<ToolResult> {
    if (!ctx.graphToken)
      return { success: false, error: "Not authenticated — please sign in" };

    const client = createGraphClient(ctx.graphToken);
    const isHtml = String(args.isHtml) === "true";

    await client.api("/me/sendMail").post({
      message: {
        subject: String(args.subject),
        body: {
          contentType: isHtml ? "HTML" : "Text",
          content: String(args.body),
        },
        toRecipients: [
          {
            emailAddress: { address: String(args.to) },
          },
        ],
      },
    });

    return { success: true, data: { sent: true, to: args.to } };
  }
}

export class SearchEmailsTool implements Tool {
  definition: ToolDefinition = {
    name: "search_emails",
    description: "Search for emails using a keyword query across subject, body, and attachments.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search keywords (e.g. 'quarterly report', 'from:john budget')",
        },
        count: {
          type: "string",
          description: "Number of results to return (default 10, max 25)",
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
      .api("/me/messages")
      .search(String(args.query))
      .top(count)
      .select("subject,from,receivedDateTime,bodyPreview")
      .get();

    const emails = response.value.map((email: any) => ({
      subject: email.subject,
      from: email.from?.emailAddress?.name ?? email.from?.emailAddress?.address,
      date: email.receivedDateTime,
      preview: email.bodyPreview?.substring(0, 200),
    }));

    return { success: true, data: emails };
  }
}
