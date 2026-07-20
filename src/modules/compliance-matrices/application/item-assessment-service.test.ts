import { describe, expect, it, vi } from "vitest";
import { ItemAssessmentService, type ItemAssessmentRepository } from "./item-assessment-service";

describe("ItemAssessmentService", () => {
  it("encaminha validação humana com correlação", async () => {
    const repository: ItemAssessmentRepository = { validate: vi.fn().mockResolvedValue({ id: "assessment" }) };
    await new ItemAssessmentService(repository).validate("item", { decision: "MEETS", justification: "Evidência suficiente e tecnicamente aderente." }, "actor", "00000000-0000-4000-8000-000000000002");
    expect(repository.validate).toHaveBeenCalledWith("item", expect.objectContaining({ decision: "MEETS" }), "actor", "00000000-0000-4000-8000-000000000002");
  });
});

