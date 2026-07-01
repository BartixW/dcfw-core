import type { ButtonInteraction, ModalSubmitInteraction } from "discord.js";
import type { CommandModule } from "./command.ts";

// src/types/global.d.ts
declare global {
   const __DEV__: boolean;
   let __dcfw_loadedCommands: Map<string, CommandModule>;
   let __dcfw_commandIds: Map<string, string>;
   let __dcfw_loadedEvents: Map<
      string,
      // biome-ignore lint/suspicious/noExplicitAny: internal
      Map<string, (...args: any[]) => Promise<void> | void>
   >;

   let __dcfw_loadedButtons: Map<
      string,
      (
         interaction: ButtonInteraction,
         userData: string | undefined,
      ) => Promise<void> | void
   >;
   let __dcfw_loadedModals: Map<
      string,
      (
         interaction: ModalSubmitInteraction,
         userData: string | undefined,
      ) => Promise<void> | void
   >;

   interface typeofGlobalThis {
      __DEV__: boolean;
      __dcfw_loadedCommands: Map<string, CommandModule>;
      __dcfw_commandIds: Map<string, string>;

      __dcfw_loadedEvents: Map<
         string,
         // biome-ignore lint/suspicious/noExplicitAny: internal
         Map<string, (...args: any[]) => Promise<void> | void>
      >;

      __dcfw_loadedButtons: Map<
         string,
         (
            interaction: ButtonInteraction,
            userData: string | undefined,
         ) => Promise<void> | void
      >;
      __dcfw_loadedModals: Map<
         string,
         (
            interaction: ModalSubmitInteraction,
            userData: string | undefined,
         ) => Promise<void> | void
      >;
   }
}
