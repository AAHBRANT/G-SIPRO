import { describe, expect, it } from "vitest";
import { rectificationSchema } from "./rectification";
const a = "00000000-0000-4000-8000-000000000001", b = "00000000-0000-4000-8000-000000000002", c = "00000000-0000-4000-8000-000000000003";
const valid = { tenderId: a, previousVersionId: b, rectifiedByVersionId: c, description: "Retificação formal do requisito técnico.", source: "Portal oficial", impacts: [{ requirementId: a, description: "Alteração da exigência de capacidade técnica." }] };
describe("rectification domain", () => {
  it("requires an explicit impact", () => expect(() => rectificationSchema.parse({ ...valid, impacts: [] })).toThrow());
  it("requires a different document version", () => expect(() => rectificationSchema.parse({ ...valid, rectifiedByVersionId: b })).toThrow());
  it("blocks duplicated impacted requirements", () => expect(() => rectificationSchema.parse({ ...valid, impacts: [valid.impacts[0], valid.impacts[0]] })).toThrow());
});
