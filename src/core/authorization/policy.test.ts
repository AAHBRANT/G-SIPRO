import { describe, expect, it } from "vitest";

import { authorize } from "@/core/authorization/policy";

describe("authorize", () => {
  it("nega por padrão quando não há contexto", () => {
    expect(authorize(undefined, { permission: "opportunities.read" })).toEqual({
      allowed: false,
      reason: "NO_CONTEXT",
    });
  });

  it("nega quando a permissão ou o escopo não estão presentes", () => {
    const context = { actorId: "actor", permissions: new Set(["opportunities.read"]), scopes: new Set(["south"]) };
    expect(authorize(context, { permission: "opportunities.write" }).allowed).toBe(false);
    expect(authorize(context, { permission: "opportunities.read", scope: "north" }).allowed).toBe(false);
  });

  it("autoriza somente quando permissão e escopo são explícitos", () => {
    const context = { actorId: "actor", permissions: new Set(["opportunities.read"]), scopes: new Set(["south"]) };
    expect(authorize(context, { permission: "opportunities.read", scope: "south" })).toEqual({
      allowed: true,
      reason: "GRANTED",
    });
  });

  it("autoriza o usuário mestre em toda a estrutura", () => {
    const context = { actorId: "master", permissions: new Set<string>(), isMaster: true };
    expect(authorize(context, { permission: "technical-archive.read" })).toEqual({ allowed: true, reason: "GRANTED" });
  });

  it("autoriza o proprietário em toda a estrutura", () => {
    const context = { actorId: "owner", permissions: new Set<string>(), isOwner: true };
    expect(authorize(context, { permission: "support.approve" })).toEqual({ allowed: true, reason: "GRANTED" });
  });
});
