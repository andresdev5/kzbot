import { BotSection } from '../models/BotConfig';

function parseAliasPrefixes(raw: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!raw) return { "'": 'speak', '$': 'fish' };

  for (const entry of raw.split(',')) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const prefix = trimmed.slice(0, eq);
    const command = trimmed.slice(eq + 1).trim().toLowerCase();
    if (!prefix || !command) continue;
    result[prefix] = command;
  }
  return result;
}

export const botConfig: BotSection = {
  token: process.env.DISCORD_TOKEN ?? '',
  clientId: process.env.DISCORD_CLIENT_ID ?? '',
  prefix: process.env.BOT_PREFIX ?? '!',
  ownerIds: (process.env.BOT_OWNER_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean),
  aliasPrefixes: parseAliasPrefixes(process.env.BOT_ALIAS_PREFIXES),
  devGuildId: process.env.DISCORD_DEV_GUILD_ID ?? '',
};
