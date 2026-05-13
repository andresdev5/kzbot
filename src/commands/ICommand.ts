import { CommandCategory } from '../enums/CommandCategory';
import { CommandContext } from '../models/CommandContext';
import { SlashCommandConfig } from '../models/SlashCommandConfig';

export interface ICommand {
  readonly name: string;
  readonly aliases: string[];
  readonly description: string;
  readonly category: CommandCategory;
  readonly usage?: string;
  readonly slash?: SlashCommandConfig;
  readonly runOnEdit?: boolean;

  execute(context: CommandContext): Promise<void>;
}
