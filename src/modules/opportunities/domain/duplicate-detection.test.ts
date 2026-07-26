import { describe, expect, it } from "vitest";

import { detectDuplicateCandidates, isNearEmptyDraft, subjectSimilarity } from "./duplicate-detection";

describe("detecção explicável de duplicidades", () => {
  it("normaliza acentos e ordem semântica simples", () => {
    expect(subjectSimilarity("Aquisição de solução técnica", "Solução tecnica para aquisição")).toBe(0.75);
  });

  it("sinaliza objeto semelhante e mesmo órgão", () => {
    const candidates = detectDuplicateCandidates(
      {
        origin: "PORTAL",
        subject: "Aquisição de solução técnica",
        contractingAuthorityId: "11111111-1111-4111-8111-111111111111",
      },
      [
        {
          id: "22222222-2222-4222-8222-222222222222",
          code: "OP-1",
          subject: "Aquisição de solução técnica",
          contractingAuthorityId: "11111111-1111-4111-8111-111111111111",
        },
      ],
    );
    expect(candidates[0]).toMatchObject({ code: "OP-1", score: 1 });
    expect(candidates[0].reasons).toContain("Mesmo órgão contratante");
  });

  it("não sinaliza objetos materialmente diferentes", () => {
    expect(
      detectDuplicateCandidates(
        { origin: "PORTAL", subject: "Construção de ponte" },
        [{ id: "1", code: "OP-1", subject: "Licença de software contábil" }],
      ),
    ).toEqual([]);
  });
});

describe("sinalização de registros quase vazios", () => {
  it("marca como quase vazio quando só o objeto está preenchido", () => {
    expect(isNearEmptyDraft({ subject: "Aquisição de solução técnica" })).toBe(true);
  });

  it("marca como quase vazio quando nenhum campo importante está preenchido", () => {
    expect(isNearEmptyDraft({})).toBe(true);
  });

  it("não marca como quase vazio quando há cliente e valor estimado além do objeto", () => {
    expect(
      isNearEmptyDraft({
        subject: "Aquisição de solução técnica",
        customerId: "11111111-1111-4111-8111-111111111111",
        estimatedValue: 50_000,
      }),
    ).toBe(false);
  });
});
