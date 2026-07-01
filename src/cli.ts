#!/usr/bin/env node

import { cac } from "cac";
import pc from "picocolors";
import { runBuild } from "./cli/build.js";
import { handleDev } from "./cli/dev.js";

const cli = cac("dcfw");

cli.command("dev", "Loads the app in development mode with live reload").action(
   async () => {
      console.log(pc.cyan("Starting up dev..."));
      handleDev();
   },
);

cli.command(
   "build",
   "Builds the app to a production-ready javascript file.",
).action(async () => {
   console.log(pc.green("Compiling project..."));
   runBuild();
});

cli.help();
cli.version("0.1.0");

cli.parse();
