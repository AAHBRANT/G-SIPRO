import { describe, expect, it } from "vitest";

import { computeArchiveAdherence, type ArchiveEvidence, type ArchiveRequirement } from "@/modules/scouting/domain/archive-adherence";

const servico = (discipline: string, description = "", parcial: Partial<ArchiveEvidence> = {}): ArchiveEvidence => ({
  serviceId: `${discipline}-${description}`.slice(0, 40),
  discipline,
  description,
  characteristics: "",
  ...parcial,
});

const exige = (subject: string, parcial: Partial<ArchiveRequirement> = {}): ArchiveRequirement =>
  ({ sources: [{ text: subject }], inferred: true, ...parcial });

/** Acervo de uma empresa que faz rodovia, mas nunca fez ponte. */
const acervoRodoviario = [
  servico("Terraplenagem", "Escavação e aterro compactado", { contractValue: 62_000_000 }),
  servico("Pavimentação asfáltica", "Revestimento em CBUQ", { contractValue: 62_000_000 }),
  servico("Drenagem", "Bueiros e sarjetas", { contractValue: 40_000_000 }),
];

describe("cobertura de serviços", () => {
  it("dá nota cheia quando o acervo cobre tudo e o porte alcança", () => {
    const a = computeArchiveAdherence(
      exige("Terraplenagem, drenagem e pavimentação asfáltica da rodovia", { estimatedValue: 30_000_000 }),
      acervoRodoviario,
    );
    expect(a.determined).toBe(true);
    expect(a.missing).toHaveLength(0);
    expect(a.score).toBe(100);
    expect(a.needsPartner).toBe(false);
  });

  /**
   * O caso que motivou toda esta reescrita. Com granularidade de tipo de obra a
   * resposta era binária; com serviço a serviço ela vira uma fração — e a
   * fração é o que diz se cabe disputar sozinho.
   */
  it("mede a fração coberta quando o objeto exige mais do que a empresa fez", () => {
    const a = computeArchiveAdherence(
      exige("Construção de ponte, terraplenagem e pavimentação asfáltica de acesso"),
      acervoRodoviario,
    );
    expect(a.required.map((r) => r.label).sort()).toEqual(["Obra de arte especial", "Pavimento asfáltico", "Terraplenagem"]);
    expect(a.missing.map((m) => m.label)).toEqual(["Obra de arte especial"]);
    // 2 de 3 cobertas, sem porte comparável: 2/3 de 80.
    expect(a.score).toBe(53);
  });

  it("aponta consórcio quando falta acervo de algum serviço", () => {
    const a = computeArchiveAdherence(exige("Construção de ponte sobre o rio"), acervoRodoviario);
    expect(a.needsPartner).toBe(true);
    expect(a.missing.map((m) => m.label)).toContain("Obra de arte especial");
    expect(a.reasons.join(" ")).toContain("falta acervo de obra de arte especial");
  });

  it("aponta consórcio também quando o porte executado não chega perto", () => {
    // Tudo coberto, mas a obra é o triplo da maior já executada.
    const a = computeArchiveAdherence(
      exige("Terraplenagem e pavimentação asfáltica", { estimatedValue: 200_000_000 }),
      acervoRodoviario,
    );
    expect(a.missing).toHaveLength(0);
    expect(a.scale).toBe("BELOW");
    expect(a.needsPartner).toBe(true);
  });

  it("não aponta consórcio quando cobre tudo e o porte alcança", () => {
    const a = computeArchiveAdherence(
      exige("Drenagem urbana", { estimatedValue: 10_000_000 }),
      acervoRodoviario,
    );
    expect(a.needsPartner).toBe(false);
  });

  it("conta quantos serviços do acervo sustentam cada categoria, e dá exemplos", () => {
    const a = computeArchiveAdherence(exige("Pavimentação asfáltica"), acervoRodoviario);
    const item = a.required.find((r) => r.label === "Pavimento asfáltico");
    expect(item?.evidenceCount).toBe(1);
    expect(item?.examples[0]).toContain("CBUQ");
  });
});

describe("o que não dá para julgar", () => {
  it("não julga objeto genérico, em vez de chutar", () => {
    const a = computeArchiveAdherence(exige("Pré-qualificação de empresas para futuras contratações"), acervoRodoviario);
    expect(a.determined).toBe(false);
    expect(a.reasons).toContain("objeto não descreve serviços reconhecíveis");
  });

  /**
   * Acervo vazio não é acervo insuficiente. Dizer 0% faria a equipe descartar
   * obra que sabe fazer só porque ninguém importou os atestados.
   */
  it("não julga sem acervo cadastrado", () => {
    const a = computeArchiveAdherence(exige("Pavimentação asfáltica"), []);
    expect(a.determined).toBe(false);
    expect(a.score).toBe(0);
    expect(a.needsPartner).toBe(false);
  });

  it("marca a leitura como estimada enquanto o requisito não vier do edital", () => {
    expect(computeArchiveAdherence(exige("Drenagem"), acervoRodoviario).requirementInferred).toBe(true);
    expect(computeArchiveAdherence(exige("Drenagem", { inferred: false }), acervoRodoviario).requirementInferred).toBe(false);
  });
});

describe("porte", () => {
  it("limita a nota a 80 quando o orçamento é sigiloso: nem zero, nem cheia", () => {
    const a = computeArchiveAdherence(exige("Terraplenagem e pavimentação asfáltica"), acervoRodoviario);
    expect(a.scale).toBe("UNKNOWN");
    expect(a.score).toBe(80);
    expect(a.reasons.join(" ")).toContain("orçamento sigiloso");
  });

  it("diz quando a culpa é do cadastro, e não da licitação", () => {
    const semValor = acervoRodoviario.map((e) => ({ ...e, contractValue: undefined }));
    const a = computeArchiveAdherence(exige("Drenagem", { estimatedValue: 10_000_000 }), semValor);
    expect(a.scale).toBe("UNKNOWN");
    expect(a.reasons.join(" ")).toContain("acervo sem valor de contrato");
  });

  it("compara com o maior contrato entre os serviços que sustentam o objeto", () => {
    // A drenagem veio de um contrato de 40 mi; a pavimentação, de 62 mi.
    const a = computeArchiveAdherence(exige("Pavimentação asfáltica", { estimatedValue: 50_000_000 }), acervoRodoviario);
    expect(a.largestExecuted).toBe(62_000_000);
    expect(a.scale).toBe("COVERED");
  });

  it("ignora contrato de serviço que não sustenta este objeto", () => {
    // Só drenagem é exigida: o contrato de 62 mi da pavimentação não vale como
    // prova de capacidade para esta obra.
    const a = computeArchiveAdherence(exige("Drenagem urbana", { estimatedValue: 50_000_000 }), acervoRodoviario);
    expect(a.largestExecuted).toBe(40_000_000);
    expect(a.scale).toBe("BELOW");
  });

  it("a nota nunca sai da faixa de 0 a 100", () => {
    const casos = [
      computeArchiveAdherence(exige("Drenagem", { estimatedValue: 1 }), acervoRodoviario),
      computeArchiveAdherence(exige("Drenagem", { estimatedValue: 9_000_000_000 }), acervoRodoviario),
      computeArchiveAdherence(exige("Construção de ponte e túnel"), acervoRodoviario),
    ];
    for (const a of casos) {
      expect(a.score).toBeGreaterThanOrEqual(0);
      expect(a.score).toBeLessThanOrEqual(100);
    }
  });
});

describe("quantitativo: acervo maior cobre exigência menor", () => {
  const acervoDePonte = [
    servico("Obra de arte especial", "Ponte em concreto protendido", { quantities: ["30 m"], contractValue: 62_000_000 }),
  ];
  const exigeQuantidade = (text: string, value: number, unit: string): ArchiveRequirement =>
    ({ sources: [{ text, quantity: { value, unit } }], inferred: false });

  /** O caso que o dono descreveu: ponte de 30 m já executada, edital pede 15 m. */
  it("ponte de 30 m no acervo cobre exigência de 15 m", () => {
    const a = computeArchiveAdherence(exigeQuantidade("Construção de ponte", 15, "m"), acervoDePonte);
    expect(a.missing).toHaveLength(0);
    expect(a.required[0]?.quantity?.verdict).toBe("COVERED");
    expect(a.reasons.join(" ")).toContain("cobre os 15 m exigidos");
  });

  /**
   * O inverso é o que protege da inabilitação: ter o serviço não basta quando o
   * edital põe número. Ponte de 30 m não cobre exigência de 80 m.
   */
  it("ter o serviço não basta quando o número não alcança", () => {
    const a = computeArchiveAdherence(exigeQuantidade("Construção de ponte", 80, "m"), acervoDePonte);
    expect(a.required[0]?.covered).toBe(false);
    expect(a.missing.map((m) => m.label)).toEqual(["Obra de arte especial"]);
    expect(a.needsPartner).toBe(true);
  });

  it("converte a unidade do acervo para a do edital", () => {
    const emKm = [servico("Pavimentação asfáltica", "CBUQ", { quantities: ["12 km"] })];
    const a = computeArchiveAdherence(exigeQuantidade("Pavimentação asfáltica", 8000, "m"), emKm);
    expect(a.required[0]?.quantity?.verdict).toBe("COVERED");
    expect(a.required[0]?.quantity?.best).toBe(12_000);
  });

  it("sem quantitativo exigido, volta a julgar só por categoria", () => {
    // É onde a leitura por objeto para: o texto não traz número.
    const a = computeArchiveAdherence(exige("Construção de ponte"), acervoDePonte);
    expect(a.required[0]?.quantity).toBeUndefined();
    expect(a.required[0]?.covered).toBe(true);
  });

  it("acervo sem número não vira reprovação: fica incomparável", () => {
    const semNumero = [servico("Obra de arte especial", "Ponte", {})];
    const a = computeArchiveAdherence(exigeQuantidade("Construção de ponte", 15, "m"), semNumero);
    expect(a.required[0]?.quantity?.verdict).toBe("INCOMPARABLE");
    // Incomparável não é insuficiente: a categoria segue coberta.
    expect(a.required[0]?.covered).toBe(true);
  });

  it("quando duas parcelas pedem o mesmo serviço, vale o maior quantitativo", () => {
    const requisito: ArchiveRequirement = {
      sources: [
        { text: "Ponte de acesso", quantity: { value: 12, unit: "m" } },
        { text: "Ponte principal", quantity: { value: 45, unit: "m" } },
      ],
      inferred: false,
    };
    const a = computeArchiveAdherence(requisito, acervoDePonte);
    // 30 m no acervo contra os 45 m exigidos: não cobre.
    expect(a.required[0]?.quantity?.required.value).toBe(45);
    expect(a.required[0]?.covered).toBe(false);
  });
});

describe("parcela que o catálogo não sabe classificar", () => {
  const acervo = [{ serviceId: "1", discipline: "Obras de arte", description: "Ponte em concreto armado", characteristics: "30 m", quantities: ["30 m"] }];
  const exigir = (textos: string[]) => computeArchiveAdherence({ sources: textos.map((text) => ({ text })), inferred: false }, acervo);

  /**
   * O defeito que este teste tranca: a parcela não classificada sumia, e
   * "Ponte + Linha de transmissão 138 kV" saía como cobertura total. A tela
   * afirmava acervo que a empresa não tem, na direção que faz perder licitação
   * por inabilitação.
   */
  it("não desaparece: fica registrada como não conferida", () => {
    const r = exigir(["Ponte em concreto armado", "Linha de transmissão 138 kV"]);
    expect(r.unreadable).toEqual(["Linha de transmissão 138 kV"]);
    expect(r.reasons.some((m) => m.includes("não soube classificar"))).toBe(true);
  });

  /**
   * E não vira "faltando", que seria o erro oposto: mandaria procurar consórcio
   * para um serviço que a empresa talvez execute.
   */
  it("não é contada como faltando, nem dispara consórcio", () => {
    const r = exigir(["Ponte em concreto armado", "Linha de transmissão 138 kV"]);
    expect(r.missing).toHaveLength(0);
    expect(r.needsPartner).toBe(false);
  });

  it("exigência inteiramente desconhecida continua sem julgamento", () => {
    const r = exigir(["Barragem de terra compactada com núcleo argiloso"]);
    expect(r.determined).toBe(false);
    expect(r.score).toBe(0);
  });

  it("sem parcela obscura, a lista sai vazia", () => {
    expect(exigir(["Ponte em concreto armado"]).unreadable).toEqual([]);
  });
});
