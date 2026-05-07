export interface SlashOptionBase {
  name: string;
  description: string;
  required?: boolean;
}

export interface SlashStringOption extends SlashOptionBase {
  type: 'string';
  choices?: { name: string; value: string }[];
  maxLength?: number;
  minLength?: number;
}

export interface SlashIntegerOption extends SlashOptionBase {
  type: 'integer';
  minValue?: number;
  maxValue?: number;
}

export interface SlashBooleanOption extends SlashOptionBase {
  type: 'boolean';
}

export interface SlashUserOption extends SlashOptionBase {
  type: 'user';
}

export interface SlashChannelOption extends SlashOptionBase {
  type: 'channel';
}

export type SlashOption =
  | SlashStringOption
  | SlashIntegerOption
  | SlashBooleanOption
  | SlashUserOption
  | SlashChannelOption;

export interface SlashCommandConfig {
  description?: string;
  options?: SlashOption[];
  slashAliases?: string[];
}
