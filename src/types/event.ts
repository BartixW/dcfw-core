import type { ClientEvents } from "discord.js";

export interface EventModule<
   K extends keyof ClientEvents = keyof ClientEvents,
> {
   execute: (...args: ClientEvents[K]) => Promise<void> | void;
}

export function defineEventConfig<
   K extends keyof ClientEvents = keyof ClientEvents,
>(config: EventModule<K>): EventModule<K> {
   return config;
}
