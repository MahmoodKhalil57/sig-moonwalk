import { z } from "zod";
// matches the entities' insert shape (the natural create/edit body).
export const PetSchema = z.object({
  id: z.number().int().optional(),
  name: z.string(),
  status: z.enum(["available", "pending", "sold"]).optional(),
  categoryId: z.number().int().nullable().optional(),
});
export const CategorySchema = z.object({
  id: z.number().int().optional(),
  name: z.string(),
});
