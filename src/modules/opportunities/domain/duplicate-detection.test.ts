import { describe, expect, it } from "vitest";

import { detectDuplicateCandidates, subjectSimilarity } from "./duplicate-detection";

describe("detecção explicável de duplicidades", () => {
  it("normaliza acentos e ordem semântica simples", () => {
    expect(subjectSimilarity("Aquisição de solução técnica", "Solução tecnica para aquisição")).toBe(0.75);
  });

  it("sinaliza objeto semelhante e mesmo órgão", () => {
    const candidates = detectDuplicateCandidates(
      {
        code: "OP-2",
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
        { code: "OP-2", origin: "PORTAL", subject: "Construção de ponte" },
        [{ id: "1", code: "OP-1", subject: "Licença de software contábil" }],
      ),
    ).toEqual([]);
  });
});
