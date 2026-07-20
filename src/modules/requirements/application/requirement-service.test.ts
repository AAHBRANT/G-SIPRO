import { describe, expect, it, vi } from "vitest";
import { RequirementService, type RequirementRecord, type RequirementRepository } from "./requirement-service";

const actor = "11111111-1111-4111-8111-111111111111";
const record: RequirementRecord = { id: "22222222-2222-4222-8222-222222222222", tenderVersionId: "33333333-3333-4333-8333-333333333333", type: "TECHNICAL", text: "Texto", criticality: "HIGH", responsibleId: actor, sourceExcerpt: "Trecho", sourcePage: 2, status: "DRAFT", version: 1 };
const empty = vi.fn();

describe("RequirementService", () => {
  it("cria requisito completo", async () => {
    const repository: RequirementRepository = { create: vi.fn(async draft => ({ ...draft, id: record.id, status: "DRAFT", version: 1 })), findById: empty, revise: empty, validate: empty };
    expect((await new RequirementService(repository).create(record, actor)).version).toBe(1);
  });

  it("versiona alterações", async () => {
    const repository: RequirementRepository = { create: empty, findById: vi.fn(async () => record), revise: vi.fn(async ({ after }) => after), validate: empty };
    expect((await new RequirementService(repository).update(record.id, { sourcePage: 3 }, actor)).version).toBe(2);
  });

  it("reabre requisito validado quando seu conteúdo muda", async () => {
    const validated = { ...record, status: "VALIDATED" as const };
    const repository: RequirementRepository = { create: empty, findById: vi.fn(async () => validated), revise: vi.fn(async ({ after }) => after), validate: empty };
    expect((await new RequirementService(repository).update(record.id, { sourcePage: 3 }, actor)).status).toBe("PENDING_VALIDATION");
  });

  it("encaminha validação humana justificada", async () => {
    const repository: RequirementRepository = { create: empty, findById: vi.fn(async () => record), revise: empty, validate: vi.fn(async () => ({ ...record, status: "VALIDATED" as const, version: 2 })) };
    const result = await new RequirementService(repository).validate(record.id, { justification: "Análises humanas concluídas." }, actor);
    expect(result.status).toBe("VALIDATED");
  });
});
