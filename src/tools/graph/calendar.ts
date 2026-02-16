import { Tool, ToolDefinition, ToolContext, ToolResult } from "../types";
import { createGraphClient } from "./graphClient";

export class ListEventsTool implements Tool {
  definition: ToolDefinition = {
    name: "list_calendar_events",
    description:
      "List upcoming calendar events from the user's Outlook calendar.",
    parameters: {
      type: "object",
      properties: {
        days: {
          type: "string",
          description: "Number of days to look ahead (default 7, max 30)",
        },
        count: {
          type: "string",
          description: "Maximum number of events (default 20)",
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
    const days = Math.min(parseInt(String(args.days ?? "7"), 10), 30);
    const count = parseInt(String(args.count ?? "20"), 10);

    const now = new Date();
    const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const response = await client
      .api("/me/calendarView")
      .query({
        startDateTime: now.toISOString(),
        endDateTime: end.toISOString(),
      })
      .top(count)
      .select("subject,start,end,location,organizer,isAllDay,webLink")
      .orderby("start/dateTime")
      .get();

    const events = response.value.map((event: any) => ({
      subject: event.subject,
      start: event.start?.dateTime,
      end: event.end?.dateTime,
      location: event.location?.displayName,
      organizer: event.organizer?.emailAddress?.name,
      isAllDay: event.isAllDay,
      webLink: event.webLink,
    }));

    return { success: true, data: events };
  }
}

export class CreateEventTool implements Tool {
  definition: ToolDefinition = {
    name: "create_calendar_event",
    description: "Create a new calendar event in the user's Outlook calendar.",
    parameters: {
      type: "object",
      properties: {
        subject: {
          type: "string",
          description: "Event title/subject",
        },
        start: {
          type: "string",
          description: "Start datetime in ISO 8601 format (e.g. 2026-02-17T09:00:00)",
        },
        end: {
          type: "string",
          description: "End datetime in ISO 8601 format (e.g. 2026-02-17T10:00:00)",
        },
        location: {
          type: "string",
          description: "Event location (optional)",
        },
        body: {
          type: "string",
          description: "Event description/body (optional)",
        },
        attendees: {
          type: "string",
          description: "Comma-separated email addresses of attendees (optional)",
        },
      },
      required: ["subject", "start", "end"],
    },
  };

  async execute(
    args: Record<string, unknown>,
    ctx: ToolContext,
  ): Promise<ToolResult> {
    if (!ctx.graphToken)
      return { success: false, error: "Not authenticated — please sign in" };

    const client = createGraphClient(ctx.graphToken);

    const event: any = {
      subject: String(args.subject),
      start: {
        dateTime: String(args.start),
        timeZone: "UTC",
      },
      end: {
        dateTime: String(args.end),
        timeZone: "UTC",
      },
    };

    if (args.location) {
      event.location = { displayName: String(args.location) };
    }
    if (args.body) {
      event.body = { contentType: "Text", content: String(args.body) };
    }
    if (args.attendees) {
      event.attendees = String(args.attendees)
        .split(",")
        .map((email: string) => ({
          emailAddress: { address: email.trim() },
          type: "required",
        }));
    }

    const created = await client.api("/me/events").post(event);

    return {
      success: true,
      data: {
        id: created.id,
        subject: created.subject,
        webLink: created.webLink,
      },
    };
  }
}
