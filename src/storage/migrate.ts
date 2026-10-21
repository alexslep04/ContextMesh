import { readFileSync } from "node:fs";
import type Database from "better-sqlite3";
const migrations = ["0000_contextmesh.sql", "0001_demo_state.sql"];
export function migrate(database: Database.Database): void {
  database.exec("CREATE TABLE IF NOT EXISTS cm_schema_migrations (name TEXT PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL)");
  for (const name of migrations) {
    if (database.prepare("SELECT name FROM cm_schema_migrations WHERE name = ?").get(name)) continue;
    const script = readFileSync(new URL("./migrations/" + name, import.meta.url), "utf8");
    database.transaction(() => {
      database.exec(script);
      database.prepare("INSERT INTO cm_schema_migrations (name, applied_at) VALUES (?, ?)").run(name, new Date().toISOString());
    })();
  }
}
