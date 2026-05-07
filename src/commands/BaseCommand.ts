import { CommandCategory } from '../enums/CommandCategory';
import { CommandContext } from '../models/CommandContext';
import { SlashCommandConfig } from '../models/SlashCommandConfig';
import { ICommand } from './ICommand';

export abstract class BaseCommand implements ICommand {
  abstract readonly name: string;
  readonly aliases: string[] = [];
  abstract readonly description: string;
  readonly category: CommandCategory = CommandCategory.General;
  readonly usage?: string;
  readonly slash?: SlashCommandConfig;

  abstract execute(context: CommandContext): Promise<void>;
}
