import {
  CloudAdapter,
  ConfigurationBotFrameworkAuthentication,
  ConfigurationBotFrameworkAuthenticationOptions,
} from "botbuilder";
import { config } from "../config";
import { logger } from "../utils/logger";

const authConfig: ConfigurationBotFrameworkAuthenticationOptions = {
  MicrosoftAppId: config.microsoftAppId,
  MicrosoftAppPassword: config.microsoftAppPassword,
  MicrosoftAppTenantId: config.microsoftAppTenantId,
  MicrosoftAppType: "SingleTenant",
};

const botAuth = new ConfigurationBotFrameworkAuthentication(authConfig);

export const adapter = new CloudAdapter(botAuth);

adapter.onTurnError = async (context, error) => {
  logger.error({ err: error }, "Bot turn error");
  await context.sendActivity(
    "Sorry, something went wrong. Please try again.",
  );
};
