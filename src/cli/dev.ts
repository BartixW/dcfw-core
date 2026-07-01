import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import pc from "picocolors";
import type { Config } from "@/types/config.js";

export async function handleDev() {
   const configFile = resolve(process.cwd(), "dcfw.config.ts");
   const config = (await import(configFile)).default as Config;

   const entryPoint = resolve(
      process.cwd(),
      config.sourceDir,
      config.entryPoint,
   );

   if (!existsSync(entryPoint)) {
      console.error(pc.red(`Entry file not found: ${entryPoint}`));
      console.error(
         pc.yellow(
            "Make sure the entry file is there and the configuration is correct.",
         ),
      );
      process.exit(1);
   }

   console.log(pc.cyan("Starting up the app with tsx..."));

   const tsxBinary = resolve(process.cwd(), "node_modules/.bin/tsx");

   const child = spawn(tsxBinary, [entryPoint], {
      stdio: "inherit",
      env: {
         ...process.env,
         DCFW_ENV: "development",
      },
   });

   child.on("close", (code) => {
      if (code !== 0 && code !== null) {
         console.log(pc.red(`\nApp exited with error (code: ${code}).`));
      } else {
         console.log(pc.gray("\n App exited"));
      }
   });
}
