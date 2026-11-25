import {
  ActionRowBuilder,
  ButtonBuilder,
  ChatInputCommandInteraction,
  Client,
  EmbedBuilder,
  Guild,
  GuildMember,
  Message,
  MessageFlags,
} from 'discord.js';

export type ContextSource = 'message' | 'interaction';

export interface DeferOptions {
  ephemeral?: boolean;
}

const PRIVATE_MESSAGE_REPLY_TTL_MS = 5_000;
const USER_MENTION = /<@!?(\d+)>/g;
const ROLE_MENTION = /<@&(\d+)>/g;
const CHANNEL_MENTION = /<#(\d+)>/g;
const CUSTOM_EMOJI = /<a?:\w+:\d+>/g;
const SYNTAX_CHARS = /[<>[\]{}]/g;

function speakableName(name: string | null | undefined): string {
  return (name ?? '').replace(SYNTAX_CHARS, '').replace(/_+/g, ' ').trim();
}

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
    public readonly preset: string | null,
  ) {}

  static fromMessage(
    client: Client,
    message: Message,
    args: string[],
    rawArgs: string,
    prefix: string,
    invokedName: string,
    preset?: string,
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
      preset ?? null,
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
      null,
    );
  }

  get guildId(): string | null {
    return this.message?.guildId ?? this.interaction?.guildId ?? null;
  }

  get userId(): string {
    return this.interaction?.user.id ?? this.message?.author.id ?? '';
  }

  async getMember(): Promise<GuildMember | null> {
    if (this.message) return this.message.member;
    const interaction = this.interaction;
    if (!interaction || !interaction.guild) return null;
    if (interaction.member instanceof GuildMember) return interaction.member;
    return interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  }

  async resolveMentions(text: string): Promise<string> {
    const guild = this.message?.guild ?? this.interaction?.guild ?? null;
    const userIds = new Set(Array.from(text.matchAll(USER_MENTION), (m) => m[1]));
    const userNames = new Map<string, string>();
    for (const id of userIds) {
      userNames.set(id, await this.displayNameFor(id, guild));
    }

    return text
      .replace(USER_MENTION, (_, id: string) => userNames.get(id) ?? '')
      .replace(ROLE_MENTION, (_, id: string) => speakableName(guild?.roles.cache.get(id)?.name))
      .replace(CHANNEL_MENTION, (_, id: string) => {
        const channel = this.client.channels.cache.get(id);
        return channel && 'name' in channel ? speakableName(channel.name) : '';
      })
      .replace(CUSTOM_EMOJI, '')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
  }

  private async displayNameFor(id: string, guild: Guild | null): Promise<string> {
    const member =
      this.message?.mentions.members?.get(id) ??
      (guild ? await guild.members.fetch(id).catch(() => null) : null);
    if (member) return speakableName(member.displayName);
    const user =
      this.message?.mentions.users.get(id) ??
      (await this.client.users.fetch(id).catch(() => null));
    return speakableName(user?.displayName);
  }

  async defer(options: DeferOptions = {}): Promise<void> {
    if (this.interaction && !this.interaction.deferred && !this.interaction.replied) {
      await this.interaction.deferReply(
        options.ephemeral ? { flags: MessageFlags.Ephemeral } : undefined,
      );
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

  async replyPrivately(payload: string | ReplyPayload): Promise<void> {
    const opts = typeof payload === 'string' ? { content: payload } : payload;
    if (this.interaction) {
      if (this.interaction.deferred) {
        await this.interaction.editReply(opts);
      } else if (this.interaction.replied) {
        await this.interaction.followUp({ ...opts, flags: MessageFlags.Ephemeral });
      } else {
        await this.interaction.reply({ ...opts, flags: MessageFlags.Ephemeral });
      }
      return;
    }
    if (this.message) {
      const sent = await this.message.reply(opts).catch(() => null);
      if (sent) {
        setTimeout(() => {
          void sent.delete().catch(() => undefined);
        }, PRIVATE_MESSAGE_REPLY_TTL_MS);
      }
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
