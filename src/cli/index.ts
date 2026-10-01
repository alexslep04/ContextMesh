#!/usr/bin/env node
import { Command } from "commander";
import { loadConfig } from "../config.js";

const program = new Command();
const config = loadConfig();

program
  .name("contextmesh")
  .description("Inspect and run the local ContextMesh coordination service")
  .version("0.1.0");

program
  .command("start")
  .description("Start the local ContextMesh service")
  .action(async () => {
    await import("../service.js");
  });

program
  .command("status")
  .description("Show the configured local service endpoint")
  .action(() => {
    console.log(JSON.stringify({ host: config.host, port: config.port, database: config.databasePath }, null, 2));
  });

for (const name of ["sessions", "conflicts", "history", "doctor"]) {
  program
    .command(name)
    .description(`Inspect ${name} (storage-backed output is added in the next slice)`)
    .action(() => console.log(`${name}: storage integration pending`));
}

await program.parseAsync();
