import { describe, expect, it } from "vitest";
import { archiveDeletionSchema } from "./archive-deletion";

describe("archiveDeletionSchema", () => {
  it("requires an auditable reason", () => {
    expect(archiveDeletionSchema.safeParse({ reason: "erro" }).success).toBe(false);
    expect(archiveDeletionSchema.parse({ reason: "Cadastro duplicado" })).toEqual({ reason: "Cadastro duplicado" });
  });
});
