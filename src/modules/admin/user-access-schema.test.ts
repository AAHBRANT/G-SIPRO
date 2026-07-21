import { describe, expect, it } from "vitest";
import { userAccessSchema } from "./user-access-schema";

const base = { displayName: "Usuário Teste", email: "usuario@aahbrant.com", status: "ACTIVE" as const, permissionIds: [] };

describe("userAccessSchema", () => {
  it("aceita proprietário mestre e ativo", () => {
    expect(userAccessSchema.parse({ ...base, isMaster: true, isOwner: true })).toMatchObject({ isMaster: true, isOwner: true });
  });

  it("impede proprietário comum ou inativo", () => {
    expect(() => userAccessSchema.parse({ ...base, isMaster: false, isOwner: true })).toThrow("proprietário deve ser um usuário mestre ativo");
    expect(() => userAccessSchema.parse({ ...base, status: "INACTIVE", isMaster: true, isOwner: true })).toThrow("proprietário deve ser um usuário mestre ativo");
  });
});
