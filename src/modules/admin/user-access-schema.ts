import { z } from "zod";

export const userAccessSchema = z.object({
  displayName: z.string().trim().min(3).max(160),
  email: z.email().transform((value) => value.toLowerCase()),
  departmentId: z.uuid().nullable().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "BLOCKED"]).default("ACTIVE"),
  isMaster: z.boolean().default(false),
  isOwner: z.boolean().default(false),
  permissionIds: z.array(z.uuid()).max(200).default([]),
}).superRefine((value, context) => {
  if (value.isOwner && (!value.isMaster || value.status !== "ACTIVE")) {
    context.addIssue({ code: "custom", message: "O proprietário deve ser um usuário mestre ativo.", path: ["isOwner"] });
  }
});
