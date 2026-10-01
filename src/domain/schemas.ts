import { z } from "zod";

export const taskPayloadSchema = z.object({
  taskId: z.string().min(1),
  title: z.string().min(1),
  expectedFiles: z.array(z.string().min(1)).default([]),
});

export const taskUpdatePayloadSchema = taskPayloadSchema.partial().extend({
  taskId: z.string().min(1),
});

export const filePayloadSchema = z.object({
  taskId: z.string().min(1),
  path: z.string().min(1),
});
