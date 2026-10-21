import { eq } from "drizzle-orm";
import type { createDatabase } from "./client.js";
import { projects } from "./schema.js";
import type { Project } from "../domain/entities.js";

type ContextMeshDatabase = ReturnType<typeof createDatabase>["db"];

export interface CreateProjectInput {
  id: string;
  repositoryPath: string;
}

export class ProjectRepository {
  constructor(private readonly db: Pick<ContextMeshDatabase, "insert" | "select">) {}

  create(input: CreateProjectInput) {
    return this.db
      .insert(projects)
      .values({
        id: input.id,
        repositoryPath: input.repositoryPath,
        createdAt: new Date().toISOString(),
      })
      .returning()
      .get();
  }

  findById(id: string) {
    return this.db
      .select()
      .from(projects)
      .where(eq(projects.id, id))
      .get();
  }

  save(project: Project): void {
    this.db.insert(projects).values(project).onConflictDoUpdate({
      target: projects.id,
      set: { repositoryPath: project.repositoryPath },
    }).run();
  }

  list() {
    return this.db.select().from(projects).all();
  }
}
