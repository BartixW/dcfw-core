import { Client, type ClientOptions } from "discord.js";
import type { CommandModule } from "@/types/command.js";
import type { EventModule } from "@/types/event.js";
import type {
   ButtonInteractionModule,
   ModalInteractionModule,
} from "@/types/interaction.js";
import { handleDev } from "./dev.js";

export async function createAppRuntime(clientOptions: ClientOptions) {
   Object.defineProperty(globalThis, "__DEV__", {
      value: process.env.DCFW_ENV === "development",
      writable: false,
      configurable: true,
   });

   if (__DEV__) {
      process.loadEnvFile();
   }

   const client = new Client(clientOptions);

   Object.defineProperty(globalThis, "__dcfw_loadedCommands", {
      value: new Map<string, CommandModule>(),
      writable: false,
      configurable: true,
   });

   Object.defineProperty(globalThis, "__dcfw_commandIds", {
      value: new Map<string, string>(),
      writable: false,
      configurable: true,
   });

   Object.defineProperty(globalThis, "__dcfw_loadedEvents", {
      value: new Map<string, EventModule>(),
      writable: false,
      configurable: true,
   });

   Object.defineProperty(globalThis, "__dcfw_loadedButtons", {
      value: new Map<string, ModalInteractionModule>(),
      writable: false,
      configurable: true,
   });

   Object.defineProperty(globalThis, "__dcfw_loadedModals", {
      value: new Map<string, ButtonInteractionModule>(),
      writable: false,
      configurable: true,
   });

   return {
      discordJsClient: client,

      async login() {
         await client.login(process.env.DISCORD_TOKEN);

         if (__DEV__) {
            await handleDev(client);
         } else {
            // @ts-expect-error
            if (globalThis.__dcfw_injectProd) {
               // @ts-expect-error
               await globalThis.__dcfw_injectProd(client);
            } else {
               console.error(
                  "[DCFW] Critical production error: Production payload was not injected during build!",
               );
            }
         }
      },

      async destroy() {
         await client.destroy();
      },
   };
}
