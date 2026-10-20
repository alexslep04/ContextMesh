import { eq } from "drizzle-orm";
import type { createDatabase } from "./client.js";
import { projects } from "./schema.js";

type ContextMeshDatabase = ReturnType<typeof createDatabase>["db"];

export interface CreateProjectInput {
  id: string;
  repositoryPath: string;
}

export class ProjectRepository {
  constructor(private readonly db: ContextMeshDatabase) {}

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

  list() {
    return this.db.select().from(projects).all();
  }
}