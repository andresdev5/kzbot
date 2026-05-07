import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { generateDependencyReport } from '@discordjs/voice';
import { inject, injectable } from 'tsyringe';
import { CommandHandler } from './CommandHandler';
import { Config } from './Config';
import { VoiceManager } from './VoiceManager';

@injectable()
export class Bot {
  private readonly client: Client;

  constructor(
    @inject(Config) private readonly config: Config,
    @inject(CommandHandler) private readonly commands: CommandHandler,
    @inject(VoiceManager) private readonly voice: VoiceManager,
  ) {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
      ],
      partials: [Partials.Channel],
    });
  }

  async start(): Promise<void> {
    console.log('--- @discordjs/voice dependency report ---');
    console.log(generateDependencyReport());
    console.log('-------------------------------------------');
    this.commands.registerAll();
    this.bindEvents();
    await this.client.login(this.config.get<string>('bot.token'));
  }

  getClient(): Client {
    return this.client;
  }

  private bindEvents(): void {
    this.client.once('clientReady', (ready) => {
      console.log(`Logged in as ${ready.user.tag}`);
      console.log(`Prefix: ${this.config.get<string>('bot.prefix')}`);
    });

    this.client.on('messageCreate', (message) => {
      void this.commands.handle(this.client, message);
    });

    this.client.on('voiceStateUpdate', (oldState, newState) => {
      this.voice.handleVoiceStateUpdate(oldState, newState);
    });

    this.client.on('error', (err) => console.error('Discord client error:', err));
  }
}
