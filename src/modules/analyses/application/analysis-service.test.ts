import { describe, expect, it } from "vitest";
import { AnalysisRuleError, AnalysisService, type AnalysisRecord, type AnalysisRepository } from "./analysis-service";

const id = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
class FakeRepository implements AnalysisRepository {
  record: AnalysisRecord | null = null;
  async create(draft: Parameters<AnalysisRepository["create"]>[0]) { return this.record = { id, ...draft, status: "PENDING", version: 1 }; }
  async findById() { return this.record; }
  async decide(record: AnalysisRecord, decision: "VALIDATED" | "REJECTED") { return this.record = { ...record, status: decision, version: record.version + 1 }; }
  async reassign(record: AnalysisRecord, assigneeId: string) { return this.record = { ...record, assigneeId, version: record.version + 1 }; }
}
describe("AnalysisService", () => {
  it("creates a pending assignment", async () => {
    const repository = new FakeRepository(); const service = new AnalysisService(repository);
    expect((await service.create({ requirementId: id, competence: "TECHNICAL", assigneeId: id }, id)).status).toBe("PENDING");
  });
  it("records a justified human decision", async () => {
    const repository = new FakeRepository(); const service = new AnalysisService(repository);
    const created = await service.create({ requirementId: id, competence: "LEGAL", assigneeId: id }, id);
    expect((await service.decide(created.id, { decision: "VALIDATED", justification: "Validado pela área jurídica." }, id)).version).toBe(2);
  });
  it("reassigns only pending work to a different user", async () => {
    const repository = new FakeRepository(); const service = new AnalysisService(repository);
    const created = await service.create({ requirementId: id, competence: "COMMERCIAL", assigneeId: id }, id);
    const reassigned = await service.reassign(created.id, { assigneeId: other, reason: "Redistribuição por competência comercial." }, id);
    expect(reassigned.assigneeId).toBe(other);
    await service.decide(created.id, { decision: "REJECTED", justification: "Rejeitado pela área comercial." }, id);
    await expect(service.reassign(created.id, { assigneeId: id, reason: "Tentativa após decisão registrada." }, id)).rejects.toBeInstanceOf(AnalysisRuleError);
  });
});
