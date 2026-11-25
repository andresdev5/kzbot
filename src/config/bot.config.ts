import { AliasPrefixTarget, BotSection } from '../models/BotConfig';

const DEFAULT_ALIAS_PREFIXES: Record<string, AliasPrefixTarget> = {
  "'": { command: 'speak' },
  $: { command: 'fish' },
  $$: { command: 'fish', preset: 's2-pro' },
};

function parseAliasTarget(raw: string): AliasPrefixTarget | null {
  const colon = raw.indexOf(':');
  const command = (colon > -1 ? raw.slice(0, colon) : raw).trim().toLowerCase();
  const preset = colon > -1 ? raw.slice(colon + 1).trim() : '';
  if (!command) return null;
  return preset ? { command, preset } : { command };
}

function parseAliasPrefixes(raw: string | undefined): Record<string, AliasPrefixTarget> {
  if (!raw) return { ...DEFAULT_ALIAS_PREFIXES };

  const result: Record<string, AliasPrefixTarget> = {};
  for (const entry of raw.split(',')) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const prefix = trimmed.slice(0, eq);
    const target = parseAliasTarget(trimmed.slice(eq + 1));
    if (!prefix || !target) continue;
    result[prefix] = target;
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
