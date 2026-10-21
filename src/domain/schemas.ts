import { z } from "zod";
import { isAbsolute, posix } from "node:path";
export const idSchema = z.string().trim().min(1).max(200);
export const textSchema = z.string().trim().min(1).max(20000);
export const filePathSchema = z.string().min(1).max(4096).transform((path) => posix.normalize(path.replaceAll("\\", "/"))).refine(
  (path) => path !== "." && !path.startsWith("/") && !/^[A-Za-z]:/.test(path) && path !== ".." && !path.startsWith("../") && !path.includes("\0"),
  "Expected a repository-relative path without parent traversal",
);
export const filesSchema = z.array(filePathSchema).max(500).transform((files) => [...new Set(files)].sort());
export const taskPayloadSchema = z.object({ taskId: idSchema, title: textSchema, expectedFiles: filesSchema.default([]), dependencies: z.array(idSchema).default([]) }).strict();
export const taskUpdatePayloadSchema = z.object({ taskId: idSchema, title: textSchema.optional(), expectedFiles: filesSchema.optional(), dependencies: z.array(idSchema).optional(), reason: textSchema.optional() }).strict().refine((p) => p.title !== undefined || p.expectedFiles !== undefined || p.dependencies !== undefined, "Supply a changed task field");
export const filePayloadSchema = z.object({ taskId: idSchema, path: filePathSchema }).strict();
export const sessionPayloadSchema = z.object({ agentType: z.enum(["codex", "claude_code", "mock"]).optional(), repositoryPath: z.string().min(1).max(4096).refine(isAbsolute, "Repository path must be absolute").optional(), hostSessionId: idSchema.optional(), integrationId: idSchema.optional() }).strict();
export const completionPayloadSchema = z.object({ taskId: idSchema, summary: textSchema, importantFiles: filesSchema.default([]), decisions: z.array(textSchema).default([]), remainingIssues: z.array(textSchema).default([]), nextSteps: z.array(textSchema).default([]) }).strict();
export const decisionPayloadSchema = z.object({ memoryId: idSchema, decision: textSchema, rationale: textSchema, taskId: idSchema.optional(), relatedFiles: filesSchema.default([]) }).strict();
export const blockerPayloadSchema = z.object({ blockerId: idSchema, description: textSchema, taskId: idSchema.optional() }).strict();
export const resolutionPayloadSchema = z.object({ blockerId: idSchema, resolution: textSchema }).strict();
export const checkpointPayloadSchema = z.object({ memoryId: idSchema, content: textSchema, taskId: idSchema.optional(), relatedFiles: filesSchema.default([]) }).strict();
export const sessionEndPayloadSchema = z.object({ reason: textSchema.optional() }).strict();
export const memoryDeletionPayloadSchema = z.object({ memoryId: idSchema, expectedVersionId: idSchema, reason: textSchema }).strict();
export const memoryRevisionPayloadSchema = memoryDeletionPayloadSchema.extend({ content: textSchema.optional(), rationale: textSchema.optional(), relatedFiles: filesSchema.optional() }).strict().refine(p => p.content !== undefined || p.rationale !== undefined || p.relatedFiles !== undefined, "Supply a changed memory field");
export const memorySearchQuerySchema = z.object({ projectId: idSchema, query: z.string().trim().min(1).max(500).optional(), limit: z.coerce.number().int().min(1).max(100).default(50) });
export const projectQuerySchema = z.object({ projectId: idSchema });
export const contextQuerySchema = projectQuerySchema.extend({ sessionId: idSchema.optional(), files: filesSchema.default([]), budget: z.coerce.number().int().min(256).max(30000).default(8000) });
