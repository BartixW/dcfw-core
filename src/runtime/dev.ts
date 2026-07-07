import { statSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import chokidar from "chokidar";
import {
   type Client,
   type InteractionReplyOptions,
   MessageFlags,
   REST,
   Routes,
} from "discord.js";
import pc from "picocolors";
import type { Config } from "@/types/config.js";
import type { EventModule } from "@/types/event.js";
import type {
   ButtonInteractionModule,
   InteractionType,
   ModalInteractionModule,
} from "@/types/interaction.js";
import type { CommandBuilder, CommandModule } from "../types/command.js";

export async function handleDev(client: Client) {
   const configFile = resolve(process.cwd(), "dcfw.config.ts");
   const config = (await import(configFile)).default as Config;
   const commandsDir = resolve(
      process.cwd(),
      config.sourceDir,
      config.commandsDirectory,
   );

   const eventsDir = resolve(
      process.cwd(),
      config.sourceDir,
      config.eventsDirectory,
   );

   const interactionsDir = resolve(
      process.cwd(),
      config.sourceDir,
      config.interactionsDirectory,
   );

   console.log(pc.cyan(`Watching for changes in: ${commandsDir}`));

   const watcher = chokidar.watch([commandsDir, eventsDir, interactionsDir], {
      persistent: true,
      ignoreInitial: false,
      usePolling: true,
      interval: 2000,
   });

   let isReady = false;

   watcher.on("add", async (filePath) => {
      await routeAndLoadFile(filePath, client, config);
      if (isReady && filePath.includes(config.commandsDirectory)) {
         await refreshDevCommands(client);
      }
   });

   watcher.on("change", async (filePath) => {
      await routeAndLoadFile(filePath, client, config);
      if (isReady && filePath.includes(config.commandsDirectory)) {
         await refreshDevCommands(client);
      }
   });

   async function routeAndLoadFile(
      filePath: string,
      client: Client,
      config: Config,
   ) {
      const relativePath = filePath.replace(
         `${resolve(process.cwd(), config.sourceDir)}/`,
         "",
      );
      const parts = relativePath.split("/");

      if (parts[0] === config.commandsDirectory) {
         await loadOrReloadCommand(filePath, client);
         return;
      }

      if (parts[0] === config.eventsDirectory && parts.length >= 3) {
         const eventName = parts[1];
         await loadOrReloadEvent(filePath, eventName, client);
         return;
      }

      if (parts[0] === config.interactionsDirectory && parts.length >= 3) {
         const interactionType = parts[1] as InteractionType;
         const interactionId = parts[2].replace(/\.[^/.]+$/, "");
         await loadOrReloadInteraction(
            filePath,
            interactionType,
            interactionId,
         );
         return;
      }
   }

   watcher.on("unlink", async (filePath) => {
      const relativePath = filePath.replace(
         `${resolve(process.cwd(), config.sourceDir)}/`,
         "",
      );
      const parts = relativePath.split("/");

      if (parts[0] !== config.commandsDirectory) return;

      const oldCommand = __dcfw_loadedCommands.get(filePath);
      if (oldCommand?.deinit) {
         try {
            await oldCommand.deinit(client);
         } catch (e) {
            console.error(pc.red(`Error executing deinit on ${filePath}:`), e);
         }
      }
      __dcfw_loadedCommands.delete(filePath);
      console.log(pc.red(`Deleted command: ${filePath}`));

      if (isReady) await refreshDevCommands(client);
   });

   client.on("interactionCreate", async (interaction) => {
      try {
         if (interaction.isCommand() || interaction.isContextMenuCommand()) {
            const commandModule = getCommandRuntimeByInteractionName(
               interaction.commandName,
            );
            // @ts-expect-error temporary fix
            if (commandModule) await commandModule.execute(interaction);
            return;
         }

         const parseCustomId = (customId: string) => {
            const [baseId, ...rest] = customId.split(":");
            return {
               baseId,
               userData: rest.length > 0 ? rest.join(":") : undefined,
            };
         };

         if (interaction.isButton()) {
            const { baseId, userData } = parseCustomId(interaction.customId);
            const executeFn = __dcfw_loadedButtons.get(baseId);
            if (executeFn) await executeFn(interaction, userData);
            return;
         }

         if (interaction.isModalSubmit()) {
            const { baseId, userData } = parseCustomId(interaction.customId);
            const executeFn = __dcfw_loadedModals.get(baseId);
            if (executeFn) await executeFn(interaction, userData);
            return;
         }
      } catch (error) {
         console.error(
            pc.red(`[DCFW RUNTIME ERROR] Error handling interaction:`),
            error,
         );

         try {
            if (interaction.isRepliable()) {
               const errorPayload: InteractionReplyOptions = {
                  content: "This action failed.",
                  flags: [MessageFlags.Ephemeral],
               };
               if (interaction.deferred || interaction.replied) {
                  await interaction.followUp(errorPayload);
               } else {
                  await interaction.reply(errorPayload);
               }
            }
         } catch (_discordError) {
            // ignore completly
         }
      }
   });

   return new Promise((resolve) => {
      watcher.on("ready", async () => {
         isReady = true;
         console.log(pc.green("Initial scan completed. Synchronizing commands with Discord..."));

         // Tutaj client.application!.id już idealnie działa, bo jesteśmy wewnątrz ready bota
         await refreshDevCommands(client);

         // 🏁 DOPIERO TUTAJ odblokowujemy await w metodzie login()!
         resolve(true);
      });
   });
}

async function loadOrReloadCommand(filePath: string, client: Client) {
   try {
      if (statSync(filePath).size === 0) return;

      const existingCommand = __dcfw_loadedCommands.get(filePath);
      if (existingCommand?.deinit) {
         console.log(pc.gray(`Running deinit on: ${filePath}`));
         await existingCommand.deinit(client);
      }

      const fileUrl = pathToFileURL(filePath).href;
      const cacheBusterUrl = `${fileUrl}?t=${Date.now()}`;

      const module = await import(cacheBusterUrl);
      const commandData = module.default as CommandModule;

      if (!commandData?.command || !commandData.execute) {
         console.warn(
            pc.red(
               `File ${filePath} doesn't export a proper command configuration.`,
            ),
         );
         return;
      }

      if (commandData.init) {
         console.log(pc.gray(`Executing init on: ${filePath}`));
         await commandData.init(client);
      }

      __dcfw_loadedCommands.set(filePath, commandData);
      console.log(pc.green(`Successfully loaded: ${filePath}`));
   } catch (error) {
      console.error(pc.red(`Error loading file ${filePath}:`), error);
   }
}

async function refreshDevCommands(client: Client) {
   const token = process.env.DISCORD_TOKEN;
   const guildId = process.env.TEST_GUILD;

   if (!token || !guildId) {
      console.warn(
         pc.yellow(
            "[DCFW] Missing DISCORD_TOKEN or TEST_GUILD in your environment. Skipping API sync.",
         ),
      );
      return;
   }

   try {
      const rawCommands: unknown[] = [];
      for (const cmdModule of __dcfw_loadedCommands.values()) {
         if (Array.isArray(cmdModule.command)) {
            rawCommands.push(
               ...cmdModule.command.map((c: CommandBuilder) => c.toJSON()),
            );
         } else {
            rawCommands.push((cmdModule.command as CommandBuilder).toJSON());
         }
      }

      const rest = new REST({ version: "10" }).setToken(token);

      const response = (await rest.put(
         // biome-ignore lint/style/noNonNullAssertion: after running client.login() the id is avaiable
         Routes.applicationGuildCommands(client.application!.id, guildId),
         { body: rawCommands },
      )) as { id: string; name: string }[];

      __dcfw_commandIds.clear();
      for (const apiCommand of response) {
         __dcfw_commandIds.set(apiCommand.name, apiCommand.id);
      }

      console.log(
         pc.blue(
            `[DCFW API] Successfully synchronized ${rawCommands.length} commands with test guild: ${guildId} (Mapped ${__dcfw_commandIds.size} IDs)`,
         ),
      );
   } catch (error) {
      console.error(
         pc.red("[DCFW API] Error refreshing guild application commands:"),
         error,
      );
   }
}

const activeDiscordListeners = new Set<string>();

async function loadOrReloadEvent(
   filePath: string,
   eventName: string,
   client: Client,
) {
   if (statSync(filePath).size === 0) return;

   try {
      const cacheBusterUrl = `${pathToFileURL(filePath).href}?t=${Date.now()}`;
      const module = await import(cacheBusterUrl);
      const eventData = module.default as EventModule;

      if (!eventData?.execute) return;

      if (!__dcfw_loadedEvents.has(eventName)) {
         __dcfw_loadedEvents.set(eventName, new Map());
      }

      __dcfw_loadedEvents.get(eventName)?.set(filePath, eventData.execute);

      if (!activeDiscordListeners.has(eventName)) {
         activeDiscordListeners.add(eventName);

         // biome-ignore lint/suspicious/noExplicitAny: internal
         client.on(eventName, async (...args: any[]) => {
            const handlers = __dcfw_loadedEvents.get(eventName);
            if (!handlers) return;

            for (const executeFn of handlers.values()) {
               try {
                  await executeFn(...args);
               } catch (err) {
                  console.error(
                     pc.red(`Error in event ${eventName} (file: ${filePath}):`),
                     err,
                  );
               }
            }
         });
      }

      console.log(
         pc.green(`Successfully loaded event [${eventName}]: ${filePath}`),
      );
   } catch (error) {
      console.error(pc.red(`Error loading event file ${filePath}:`), error);
   }
}

async function loadOrReloadInteraction(
   filePath: string,
   type: InteractionType,
   id: string,
) {
   if (statSync(filePath).size === 0) return;

   try {
      const cacheBusterUrl = `${pathToFileURL(filePath).href}?t=${Date.now()}`;
      const module = await import(cacheBusterUrl);
      const interactionData = module.default as
         | ButtonInteractionModule
         | ModalInteractionModule;

      if (!interactionData?.execute) {
         console.warn(
            pc.red(
               `File ${filePath} doesn't export a proper interaction configuration.`,
            ),
         );
         return;
      }

      if (type === "button") {
         __dcfw_loadedButtons.set(
            id,
            (interactionData as ButtonInteractionModule).execute,
         );
      } else if (type === "modalsubmit") {
         __dcfw_loadedModals.set(
            id,
            (interactionData as ModalInteractionModule).execute,
         );
      }

      console.log(
         pc.green(
            `Successfully loaded interaction [${type}:${id}]: ${filePath}`,
         ),
      );
   } catch (error) {
      console.error(
         pc.red(`Error loading interaction file ${filePath}:`),
         error,
      );
   }
}

export function getCommandRuntimeByInteractionName(
   interactionName: string,
): CommandModule | undefined {
   for (const cmd of __dcfw_loadedCommands.values()) {
      if (Array.isArray(cmd.command)) {
         if (
            cmd.command.some((b: CommandBuilder) => b.name === interactionName)
         )
            return cmd;
      } else {
         if ((cmd.command as CommandBuilder).name === interactionName)
            return cmd;
      }
   }
   return undefined;
}
