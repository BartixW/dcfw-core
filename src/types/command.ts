// src/types/index.ts
import type {
   ChatInputCommandInteraction,
   Client,
   ContextMenuCommandBuilder,
   ContextMenuCommandInteraction,
   SlashCommandBuilder,
} from "discord.js";

export type CommandBuilder = SlashCommandBuilder | ContextMenuCommandBuilder;

export type CommandInteraction =
   | ChatInputCommandInteraction
   | ContextMenuCommandInteraction;

export interface CommandModule {
   /**
    * Command builder(s)
    */
   command: CommandBuilder | readonly CommandBuilder[];

   /**
    * Main command entry point
    */
   execute: (interaction: CommandInteraction) => Promise<void> | void;

   /**
    * Runs on app startup
    */
   init?: (client: Client) => Promise<void> | void;

   /**
    * Runs on app exit
    */
   deinit?: (client: Client) => Promise<void> | void;
}

export function defineCommandConfig(config: CommandModule): CommandModule {
   return config;
}
