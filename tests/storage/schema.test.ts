import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";

describe("SQLite foundation", () => {
  it("supports the initial schema and FTS5 index", () => {
    const database = new Database(":memory:");
    const migration = readFileSync("src/storage/migrations/0000_contextmesh.sql", "utf8");

    database.exec(migration);
    database.prepare(
      "INSERT INTO cm_memory_search (memory_version_id, project_id, kind, content) VALUES (?, ?, ?, ?)",
    ).run("version-1", "project-1", "decision", "Use normalized events");

    const result = database.prepare(
      "SELECT memory_version_id FROM cm_memory_search WHERE cm_memory_search MATCH ?",
    ).get("normalized");

    expect(result).toEqual({ memory_version_id: "version-1" });
    database.close();
  });
});
