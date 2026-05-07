import { Client, Message } from 'discord.js';

export interface CommandContext {
  client: Client;
  message: Message;
  args: string[];
  rawArgs: string;
  prefix: string;
  invokedName: string;
}
