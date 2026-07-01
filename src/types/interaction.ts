import type { ButtonInteraction, ModalSubmitInteraction } from "discord.js";

export type InteractionType = "button" | "modalsubmit";

export interface ButtonInteractionModule {
   execute: (
      interaction: ButtonInteraction,
      userData: string | undefined,
   ) => Promise<void> | void;
}

export interface ModalInteractionModule {
   execute: (
      interaction: ModalSubmitInteraction,
      userData: string | undefined,
   ) => Promise<void> | void;
}

export function defineButtonInteractionConfig(
   config: ButtonInteractionModule,
): ButtonInteractionModule {
   return config;
}

export function defineModalSubmitInteractionConfig(
   config: ModalInteractionModule,
): ModalInteractionModule {
   return config;
}
