import {
  ActionRowBuilder,
  ButtonBuilder,
  ChatInputCommandInteraction,
  Client,
  EmbedBuilder,
  GuildMember,
  Message,
} from 'discord.js';

export type ContextSource = 'message' | 'interaction';

export interface ReplyPayload {
  content?: string;
  embeds?: EmbedBuilder[];
  components?: ActionRowBuilder<ButtonBuilder>[];
}

export class CommandContext {
  private constructor(
    public readonly client: Client,
    public readonly source: ContextSource,
    public readonly args: string[],
    public readonly rawArgs: string,
    public readonly prefix: string,
    public readonly invokedName: string,
    public readonly message: Message | null,
    public readonly interaction: ChatInputCommandInteraction | null,
  ) {}

  static fromMessage(
    client: Client,
    message: Message,
    args: string[],
    rawArgs: string,
    prefix: string,
    invokedName: string,
  ): CommandContext {
    return new CommandContext(
      client,
      'message',
      args,
      rawArgs,
      prefix,
      invokedName,
      message,
      null,
    );
  }

  static fromInteraction(
    client: Client,
    interaction: ChatInputCommandInteraction,
  ): CommandContext {
    return new CommandContext(
      client,
      'interaction',
      [],
      '',
      '/',
      interaction.commandName,
      null,
      interaction,
    );
  }

  get guildId(): string | null {
    return this.message?.guildId ?? this.interaction?.guildId ?? null;
  }

  async getMember(): Promise<GuildMember | null> {
    if (this.message) return this.message.member;
    const interaction = this.interaction;
    if (!interaction || !interaction.guild) return null;
    if (interaction.member instanceof GuildMember) return interaction.member;
    return interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  }

  async defer(): Promise<void> {
    if (this.interaction && !this.interaction.deferred && !this.interaction.replied) {
      await this.interaction.deferReply();
      return;
    }
    if (this.message?.channel.isSendable()) {
      void this.message.channel.sendTyping().catch(() => undefined);
    }
  }

  async reply(payload: string | ReplyPayload): Promise<void> {
    const opts = typeof payload === 'string' ? { content: payload } : payload;
    if (this.interaction) {
      if (this.interaction.deferred) {
        await this.interaction.editReply(opts);
      } else if (this.interaction.replied) {
        await this.interaction.followUp(opts);
      } else {
        await this.interaction.reply(opts);
      }
      return;
    }
    if (this.message) {
      await this.message.reply(opts).catch(() => undefined);
    }
  }

  async send(payload: string | ReplyPayload): Promise<Message | null> {
    const opts = typeof payload === 'string' ? { content: payload } : payload;
    if (this.interaction) {
      if (this.interaction.deferred) {
        return (await this.interaction.editReply(opts)) as Message;
      }
      if (this.interaction.replied) {
        return (await this.interaction.followUp(opts)) as Message;
      }
      return (await this.interaction.reply({ ...opts, withResponse: true }))
        .resource?.message as Message | null ?? null;
    }
    if (this.message) {
      return this.message.reply(opts).catch(() => null);
    }
    return null;
  }
}
