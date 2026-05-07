import { BotSection } from '../models/BotConfig';

export const botConfig: BotSection = {
  token: process.env.DISCORD_TOKEN ?? '',
  clientId: process.env.DISCORD_CLIENT_ID ?? '',
  prefix: process.env.BOT_PREFIX ?? '!',
  ownerIds: (process.env.BOT_OWNER_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean),
};
