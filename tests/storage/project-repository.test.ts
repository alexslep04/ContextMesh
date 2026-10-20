import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { createDatabase } from "../../src/storage/client.js";
import { ProjectRepository } from "../../src/storage/project-repository.js";

it("retrieves a saved project after reopening the database", () => {
  const directory = mkdtempSync(join(tmpdir(), "contextmesh-project-"));
  const databasePath = join(directory, "contextmesh.db");
  let database: ReturnType<typeof createDatabase> | undefined;

  try {
    database = createDatabase(databasePath);
    const repository = new ProjectRepository(database.db);

    const saved = repository.create({
      id: "project-1",
      repositoryPath: "/example/contextmesh",
    });

    expect(saved.id).toBe("project-1");
    expect(saved.repositoryPath).toBe("/example/contextmesh");
    expect(repository.findById("missing")).toBeUndefined();

    database.sqlite.close();
    database = undefined;

    database = createDatabase(databasePath);
    const reopenedRepository = new ProjectRepository(database.db);

    expect(reopenedRepository.findById("project-1")).toEqual(saved);
    expect(reopenedRepository.list()).toEqual([saved]);
  } finally {
    database?.sqlite.close();
    rmSync(directory, { recursive: true, force: true });
  }
});