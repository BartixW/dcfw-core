import { mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { build } from "esbuild";
import pc from "picocolors";
import type { Config } from "@/types/config.js";

export async function runBuild() {
   const configFile = resolve(process.cwd(), "dcfw.config.ts");
   const config = (await import(configFile)).default as Config;

   const srcDir = resolve(process.cwd(), config.sourceDir);
   const outputDir = resolve(process.cwd(), ".dcfw");
   mkdirSync(outputDir, { recursive: true });

   let importSection = `import { startAppRuntime } from "@dcfw/core";\n\n`;
   let hydrationSection = `\n// Hydrate global registers before runtime starts\n`;

   let fileCounter = 0;

   function scanDirectory(dir: string, callback: (filePath: string) => void) {
      if (!statSync(dir).isDirectory()) return;
      const files = readdirSync(dir);
      for (const file of files) {
         const fullPath = join(dir, file);
         if (statSync(fullPath).isDirectory()) {
            scanDirectory(fullPath, callback);
         } else if ([".ts", ".js", ".mts"].includes(extname(fullPath))) {
            callback(fullPath);
         }
      }
   }

   const commandsPath = join(srcDir, config.commandsDirectory);
   scanDirectory(commandsPath, (filePath) => {
      const relPath = relative(outputDir, filePath).replace(/\\/g, "/");
      const varName = `cmd_${fileCounter++}`;
      importSection += `import ${varName} from "${relPath}";\n`;
      hydrationSection += `__dcfw_loadedCommands.set("${varName}", ${varName});\n`;
   });

   const interactionsPath = join(srcDir, config.interactionsDirectory);
   scanDirectory(interactionsPath, (filePath) => {
      const relPath = relative(outputDir, filePath).replace(/\\/g, "/");
      const parts = relative(interactionsPath, filePath).split("/"); // [type, file]
      if (parts.length < 2) return;

      const type = parts[0]; // "button" | "modalsubmit"
      const id = parts[1].replace(/\.[^/.]+$/, "");
      const varName = `int_${fileCounter++}`;

      importSection += `import ${varName} from "${relPath}";\n`;
      if (type === "button") {
         hydrationSection += `__dcfw_loadedButtons.set("${id}", ${varName}.execute);\n`;
      } else if (type === "modalsubmit") {
         hydrationSection += `__dcfw_loadedModals.set("${id}", ${varName}.execute);\n`;
      }
   });

   const eventsPath = join(srcDir, config.eventsDirectory);
   scanDirectory(eventsPath, (filePath) => {
      const relPath = relative(outputDir, filePath).replace(/\\/g, "/");
      const parts = relative(eventsPath, filePath).split("/"); // [eventName, file]
      if (parts.length < 2) return;

      const eventName = parts[0];
      const varName = `evt_${fileCounter++}`;

      importSection += `import ${varName} from "${relPath}";\n`;
      hydrationSection += `if (!__dcfw_loadedEvents.has("${eventName}")) __dcfw_loadedEvents.set("${eventName}", new Map());\n`;
      hydrationSection += `__dcfw_loadedEvents.get("${eventName}").set("${relPath}", ${varName}.execute);\n`;
   });

   const entrypointCode = `
import { handleProd } from "@dcfw/core";
${importSection}

globalThis.__dcfw_injectProd = async (client: any) => {
   ${hydrationSection}
   await handleProd(client);
};

import "../${join(config.sourceDir, config.entryPoint)}"; 
`.trim();

   const entrypointPath = join(outputDir, "entrypoint.ts");
   writeFileSync(entrypointPath, entrypointCode, "utf-8");
   console.log("Generated production entrypoint in .dcfw/entrypoint.ts");

   try {
      const startTime = Date.now();

      await build({
         entryPoints: [entrypointPath],
         outfile: resolve(process.cwd(), config.outFile),
         bundle: true,
         platform: "node",
         format: "esm",
         target: "node20",
         minify: true,
         sourcemap: false,

         plugins: [
            {
               name: "external-all-except-project",
               setup(build) {
                  build.onResolve({ filter: /^[^./]|^\.[^./]/ }, (args) => {
                     if (args.path.startsWith("@/")) {
                        return undefined;
                     }
                     return { path: args.path, external: true };
                  });
               },
            },
         ],
      });

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(
         pc.green(
            `Successfully built production bundle into ${config.outFile} in ${duration}s!`,
         ),
      );
   } catch (error) {
      console.error(
         pc.red("[DCFW BUILD ERROR] Failed to bundle the project:"),
         error,
      );
      process.exit(1);
   }
}
