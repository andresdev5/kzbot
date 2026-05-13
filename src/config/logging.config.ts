import { LogLevel, LoggingSection } from '../models/BotConfig';

const VALID_LEVELS: LogLevel[] = ['DEBUG', 'INFO', 'ERROR'];

function parseLogLevel(raw: string | undefined): LogLevel {
  if (!raw) return 'INFO';
  const upper = raw.trim().toUpperCase();
  return (VALID_LEVELS as string[]).includes(upper) ? (upper as LogLevel) : 'INFO';
}

export const loggingConfig: LoggingSection = {
  level: parseLogLevel(process.env.LOG_LEVEL),
};
