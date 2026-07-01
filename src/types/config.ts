export interface Config {
   /**
    * Source directory
    */
   sourceDir: string;
   /**
    * Entry point (relative to sourceDir)
    */
   entryPoint: string;
   /**
    * Build output file path
    */
   outFile: string;
   /**
    * Commands directory (relative to sourceDir)
    */
   commandsDirectory: string;
   /**
    * Events directory (relative to sourceDir)
    */
   eventsDirectory: string;
   /**
    * Interactions directory (relative to sourceDir)
    */
   interactionsDirectory: string;
}

export function defineConfig(config: Config): Config {
   return config;
}
