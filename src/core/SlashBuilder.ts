import { SlashCommandBuilder } from 'discord.js';
import { ICommand } from '../commands/ICommand';

const MAX_DESC = 100;

export function buildSlashCommands(command: ICommand): SlashCommandBuilder[] {
  if (!command.slash) return [];

  const cfg = command.slash;
  const description = (cfg.description ?? command.description).slice(0, MAX_DESC);
  const aliases = cfg.slashAliases ?? [];

  for (const alias of aliases) {
    if (!command.aliases.includes(alias)) {
      throw new Error(
        `Slash alias "${alias}" for command "${command.name}" is not in the command's aliases list. Add it to aliases first.`,
      );
    }
  }

  const names = [command.name, ...aliases];
  return names.map((name) => buildOne(name, description, cfg.options ?? []));
}

function buildOne(
  name: string,
  description: string,
  options: NonNullable<ICommand['slash']>['options'] extends infer T ? Exclude<T, undefined> : never,
): SlashCommandBuilder {
  const builder = new SlashCommandBuilder().setName(name).setDescription(description);

  for (const opt of options) {
    switch (opt.type) {
      case 'string':
        builder.addStringOption((b) => {
          b.setName(opt.name).setDescription(opt.description.slice(0, MAX_DESC));
          if (opt.required) b.setRequired(true);
          if (opt.choices) b.addChoices(...opt.choices);
          if (opt.minLength !== undefined) b.setMinLength(opt.minLength);
          if (opt.maxLength !== undefined) b.setMaxLength(opt.maxLength);
          return b;
        });
        break;
      case 'integer':
        builder.addIntegerOption((b) => {
          b.setName(opt.name).setDescription(opt.description.slice(0, MAX_DESC));
          if (opt.required) b.setRequired(true);
          if (opt.minValue !== undefined) b.setMinValue(opt.minValue);
          if (opt.maxValue !== undefined) b.setMaxValue(opt.maxValue);
          return b;
        });
        break;
      case 'boolean':
        builder.addBooleanOption((b) => {
          b.setName(opt.name).setDescription(opt.description.slice(0, MAX_DESC));
          if (opt.required) b.setRequired(true);
          return b;
        });
        break;
      case 'user':
        builder.addUserOption((b) => {
          b.setName(opt.name).setDescription(opt.description.slice(0, MAX_DESC));
          if (opt.required) b.setRequired(true);
          return b;
        });
        break;
      case 'channel':
        builder.addChannelOption((b) => {
          b.setName(opt.name).setDescription(opt.description.slice(0, MAX_DESC));
          if (opt.required) b.setRequired(true);
          return b;
        });
        break;
    }
  }

  return builder;
}
