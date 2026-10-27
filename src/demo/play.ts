import { join, resolve } from "node:path";
import { existsSync } from "node:fs";
import { presentSnake } from "./preview.js";
try {
  const directory = process.argv[2];
  if (!directory) throw new Error('Usage: npm run demo:play -- "<demo-directory>"');
  const repositoryPath = join(resolve(directory), "repository");
  if (!existsSync(join(repositoryPath, "index.html"))) throw new Error("No completed Snake game in this demo directory");
  await presentSnake(repositoryPath);
} catch (error) { console.error(error instanceof Error ? error.message : "Preview failed"); process.exitCode = 1; }
