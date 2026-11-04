import { z } from "zod";

export const MAX_CONTENT_BYTES = 512 * 1024; // serialized editor JSON
export const MAX_UPLOAD_BYTES = 1024 * 1024; // 1 MB

export const titleSchema = z
  .string()
  .trim()
  .min(1, "Title can't be empty.")
  .max(200, "Title must be 200 characters or fewer.");

// Tiptap document JSON: a root node of type "doc". The schema itself drops
// unknown nodes when the editor loads it, so we only check shape and size here.
export const contentSchema = z
  .object({ type: z.literal("doc"), content: z.array(z.unknown()).optional() })
  .passthrough()
  .refine((c) => JSON.stringify(c).length <= MAX_CONTENT_BYTES, "Document is too large to save (512 KB max).");

export const createDocSchema = z.object({ title: titleSchema.optional() });

export const patchDocSchema = z.union([
  z.object({ title: titleSchema }).strict(),
  z.object({ content: contentSchema, version: z.number().int().positive() }).strict(),
]);

export const sessionSchema = z.object({ userId: z.string().min(1).max(64) });

export const shareSchema = z.object({
  userId: z.string().min(1).max(64),
  role: z.enum(["viewer", "editor"], { message: "Role must be viewer or editor." }),
});

export const unshareSchema = z.object({ userId: z.string().min(1).max(64) });
