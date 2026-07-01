import { Client, type ClientOptions } from "discord.js";
import type { CommandModule } from "@/types/command.js";
import { handleDev } from "./dev.js";

export async function startAppRuntime(clientOptions: ClientOptions) {
   Object.defineProperty(globalThis, "__DEV__", {
      value: process.env.DCFW_ENV === "development",
      writable: false,
      configurable: true,
   });

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
      value: new Map<string, CommandModule>(),
      writable: false,
      configurable: true,
   });

   Object.defineProperty(globalThis, "__dcfw_loadedButtons", {
      value: new Map<string, CommandModule>(),
      writable: false,
      configurable: true,
   });

   Object.defineProperty(globalThis, "__dcfw_loadedModals", {
      value: new Map<string, CommandModule>(),
      writable: false,
      configurable: true,
   });

   if (__DEV__) {
      process.loadEnvFile();
      await client.login(process.env.DISCORD_TOKEN);
      await handleDev(client);
   } else {
      await client.login(process.env.DISCORD_TOKEN);

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

   return {
      discordJsClient: client,
      async destroy() {
         await client.destroy();
      },
   };
}
