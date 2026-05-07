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
    this.client.once('clientReady', async (ready) => {
      console.log(`Logged in as ${ready.user.tag}`);
      console.log(`Prefix: ${this.config.get<string>('bot.prefix')}`);
      await this.registerSlashCommands(ready);
    });

    this.client.on('messageCreate', (message) => {
      void this.commands.handle(this.client, message);
    });

    this.client.on('interactionCreate', (interaction) => {
      if (interaction.isChatInputCommand()) {
        void this.commands.handleInteraction(this.client, interaction);
      }
    });

    this.client.on('voiceStateUpdate', (oldState, newState) => {
      this.voice.handleVoiceStateUpdate(oldState, newState);
    });

    this.client.on('error', (err) => console.error('Discord client error:', err));
  }

  private async registerSlashCommands(ready: Client<true>): Promise<void> {
    const json = this.commands.buildSlashJson();
    if (json.length === 0) {
      console.log('No slash commands declared.');
      return;
    }

    const devGuildId = this.config.get<string>('bot.devGuildId');
    try {
      if (devGuildId) {
        const guild = await ready.guilds.fetch(devGuildId);
        await guild.commands.set(json);
        console.log(`Registered ${json.length} guild slash command(s) in ${guild.name}.`);
      } else {
        await ready.application.commands.set(json);
        console.log(
          `Registered ${json.length} global slash command(s) (propagation can take up to 1h).`,
        );
      }
    } catch (err) {
      console.error('Failed to register slash commands:', err);
    }
  }
}
