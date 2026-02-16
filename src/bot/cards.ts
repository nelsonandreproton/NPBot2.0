import { CardFactory, Attachment } from "botbuilder";

export function createSignInCard(connectionName: string): Attachment {
  return CardFactory.oauthCard(connectionName, "Sign In", "Sign in to access your Microsoft 365 data");
}

export function createThinkingCard(): Attachment {
  const card = {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.4",
    body: [
      {
        type: "TextBlock",
        text: "Thinking...",
        wrap: true,
        isSubtle: true,
        fontType: "Default",
        size: "Small",
      },
    ],
  };
  return CardFactory.adaptiveCard(card);
}

export function createToolCallCard(
  toolName: string,
  status: "running" | "done" | "error",
): Attachment {
  const statusEmoji =
    status === "running" ? "..." : status === "done" ? "OK" : "ERR";
  const card = {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.4",
    body: [
      {
        type: "TextBlock",
        text: `[${statusEmoji}] ${toolName}`,
        wrap: true,
        fontType: "Monospace",
        size: "Small",
        isSubtle: true,
      },
    ],
  };
  return CardFactory.adaptiveCard(card);
}
