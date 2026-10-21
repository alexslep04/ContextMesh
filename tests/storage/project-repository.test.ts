import { join } from "node:path";
import { expect, it } from "vitest";
import { createDatabase } from "../../src/storage/client.js";
import { ProjectRepository } from "../../src/storage/project-repository.js";
import { EventProcessor } from "../../src/application/event-processor.js";
import { SqliteEventPersistence } from "../../src/storage/sqlite-event-persistence.js";
import { events, temporaryDirectory } from "../helpers.js";

it("retrieves a saved project after reopening the database", () => {
  const temporary = temporaryDirectory(), directory = temporary.path;
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
    temporary.remove();
  }
});

it("shares project records with event persistence and preserves creation time on projection updates", () => {
  const database = createDatabase(":memory:"), clock = events();
  try {
    const repository = new ProjectRepository(database.db);
    const saved = repository.create({ id: "p", repositoryPath: "" });
    const processor = new EventProcessor(new SqliteEventPersistence(database.sqlite));
    expect(processor.snapshot("p").projects).toEqual([saved]);
    processor.ingest(clock.event("session_started", { repositoryPath: process.cwd(), agentType: "mock" }));
    const stored = repository.findById("p");
    expect(stored).toMatchObject({ id: "p", repositoryPath: process.cwd(), createdAt: saved.createdAt });
    expect(new SqliteEventPersistence(database.sqlite).load().snapshot.projects).toEqual([stored]);
    expect(database.sqlite.prepare("SELECT count(*) AS n FROM cm_schema_migrations").get()).toEqual({ n: 2 });
  } finally { database.sqlite.close(); }
});
