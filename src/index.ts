import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';

loadEnv();

import { container } from 'tsyringe';
import { Bot } from './core/Bot';
import { registerCommands } from './commands';

async function main(): Promise<void> {
  registerCommands();
  const bot = container.resolve(Bot);
  await bot.start();
}

main().catch((err) => {
  console.error('Fatal error during bot startup:', err);
  process.exit(1);
});
