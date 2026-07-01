import {
   type Client,
   type InteractionReplyOptions,
   MessageFlags,
   REST,
   Routes,
} from "discord.js";
import pc from "picocolors";
import type { CommandBuilder } from "../types/command.js";
import { getCommandRuntimeByInteractionName } from "./dev.js";

export async function handleProd(client: Client) {
   console.log(pc.green("[DCFW] Starting production runtime..."));

   await registerGlobalCommands(client);

   setupProdInteractionRouter(client);

   setupProdEventRouter(client);
}

async function registerGlobalCommands(client: Client) {
   const token = process.env.DISCORD_TOKEN;
   if (!token) {
      console.error(
         pc.red("[DCFW PROD] Missing DISCORD_TOKEN in your environment!"),
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
         Routes.applicationCommands(client.application!.id),
         { body: rawCommands },
      )) as { id: string; name: string }[];

      __dcfw_commandIds.clear();
      for (const apiCommand of response) {
         __dcfw_commandIds.set(apiCommand.name, apiCommand.id);
      }

      console.log(
         pc.blue(
            `[DCFW PROD] Successfully synchronized ${rawCommands.length} global commands with Discord API.`,
         ),
      );
   } catch (error) {
      console.error(
         pc.red("[DCFW PROD] Error synchronizing global commands:"),
         error,
      );
   }
}

function setupProdInteractionRouter(client: Client) {
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
            // ignore
         }
      }
   });
}

function setupProdEventRouter(client: Client) {
   for (const eventName of __dcfw_loadedEvents.keys()) {
      // biome-ignore lint/suspicious/noExplicitAny: internal
      client.on(eventName, async (...args: any[]) => {
         const handlers = __dcfw_loadedEvents.get(eventName);
         if (!handlers) return;

         for (const executeFn of handlers.values()) {
            try {
               await executeFn(...args);
            } catch (err) {
               console.error(
                  pc.red(`[DCFW PROD ERROR] Error in event ${eventName}:`),
                  err,
               );
            }
         }
      });
   }
   console.log(
      pc.blue(
         `[DCFW PROD] Successfully attached listeners for ${__dcfw_loadedEvents.size} events.`,
      ),
   );
}
