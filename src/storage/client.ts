import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";
import { migrate } from "./migrate.js";

export function createDatabase(path: string) {
  mkdirSync(dirname(path), { recursive: true });

  const sqlite = new Database(path);

  try {
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("busy_timeout = 5000");
    sqlite.pragma("foreign_keys = ON");

    migrate(sqlite);

    return { sqlite, db: drizzle(sqlite, { schema }) };
  } catch (error) {
    sqlite.close();
    throw error;
  }
}
