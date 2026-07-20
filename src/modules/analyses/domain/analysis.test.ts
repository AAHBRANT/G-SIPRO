import { describe, expect, it } from "vitest";
import { analysisDecisionSchema, analysisReassignmentSchema, analysisSchema } from "./analysis";

const id = "00000000-0000-4000-8000-000000000001";
describe("analysis domain", () => {
  it("accepts the five approved competence areas", () => {
    for (const competence of ["TECHNICAL", "LEGAL", "COMMERCIAL", "FINANCIAL", "ACCOUNTING"]) {
      expect(analysisSchema.parse({ requirementId: id, competence, assigneeId: id }).competence).toBe(competence);
    }
  });
  it("requires a human justification for a decision", () => {
    expect(() => analysisDecisionSchema.parse({ decision: "VALIDATED", justification: "curta" })).toThrow();
  });
  it("requires a reason for reassignment", () => {
    expect(() => analysisReassignmentSchema.parse({ assigneeId: id, reason: "curto" })).toThrow();
  });
});
