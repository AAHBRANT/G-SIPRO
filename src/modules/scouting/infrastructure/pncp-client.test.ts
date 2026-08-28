import { describe, expect, it, vi } from "vitest";

import { brazilStates, buildNoticeUrl, cleanSubject, formatFinalDate, isMirrorRecord, PncpClient, toCandidate, workModalityCodes } from "@/modules/scouting/infrastructure/pncp-client";

const baseRecord = {
  numeroControlePNCP: "07954480000179-1-000019/2026",
  objetoCompra: "  Pavimentação   da rodovia CE-363  ",
  modalidadeNome: "Concorrência - Eletrônica",
  valorTotalEstimado: 30_192_881.72,
  dataAberturaProposta: "2026-07-24T08:00:00",
  dataEncerramentoProposta: "2026-08-07T09:30:00",
  anoCompra: 2026,
  sequencialCompra: 19263,
  orgaoEntidade: { cnpj: "07954480000179", razaoSocial: "ESTADO DO CEARA", esferaId: "E" },
  unidadeOrgao: { municipioNome: "Senador Pompeu", ufSigla: "CE" },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("formatFinalDate", () => {
  it("formata a data no padrão AAAAMMDD exigido pelo portal", () => {
    expect(formatFinalDate(new Date("2027-12-31T00:00:00.000Z"))).toBe("20271231");
  });
});

describe("buildNoticeUrl", () => {
  it("monta o endereço do edital a partir de documento, ano e sequencial", () => {
    expect(buildNoticeUrl(baseRecord)).toBe("https://pncp.gov.br/app/editais/07954480000179/2026/19263");
  });

  it("não monta endereço quando falta o sequencial", () => {
    expect(buildNoticeUrl({ ...baseRecord, sequencialCompra: undefined })).toBeUndefined();
  });
});

describe("isMirrorRecord", () => {
  it("reconhece registro espelho com abertura igual ao encerramento", () => {
    const mirror = { ...baseRecord, dataAberturaProposta: "2026-08-07T09:30:00", dataEncerramentoProposta: "2026-08-07T09:30:00" };
    expect(isMirrorRecord(mirror)).toBe(true);
  });

  it("não trata prazo real como espelho", () => {
    expect(isMirrorRecord(baseRecord)).toBe(false);
  });
});

describe("cleanSubject", () => {
  it("remove o prefixo da plataforma de disputa", () => {
    expect(cleanSubject("[Portal de Compras Públicas] - CONTRATAÇÃO DE EMPRESA")).toBe("CONTRATAÇÃO DE EMPRESA");
  });

  it("remove prefixo entre parênteses e com travessão", () => {
    expect(cleanSubject("(Licitar Digital) – Execução de obra")).toBe("Execução de obra");
  });

  it("preserva o objeto quando não há prefixo", () => {
    expect(cleanSubject("  Pavimentação   da rodovia CE-363 ")).toBe("Pavimentação da rodovia CE-363");
  });

  it("não corta colchete que faz parte do objeto", () => {
    const longo = "[trecho muito extenso que claramente não é nome de plataforma de compras e passa de sessenta caracteres] obra";
    expect(cleanSubject(longo)).toBe(longo);
  });
});

describe("toCandidate", () => {
  it("converte registro do portal em candidata", () => {
    const candidate = toCandidate(baseRecord);
    expect(candidate).toMatchObject({
      externalId: "07954480000179-1-000019/2026",
      subject: "Pavimentação da rodovia CE-363",
      authorityName: "ESTADO DO CEARA",
      sphere: "E",
      state: "CE",
      estimatedValue: 30_192_881.72,
      valueUndisclosed: false,
    });
  });

  it("trata valor zerado como sigiloso, e não como obra sem custo", () => {
    const candidate = toCandidate({ ...baseRecord, valorTotalEstimado: 0 });
    expect(candidate?.valueUndisclosed).toBe(true);
    expect(candidate?.estimatedValue).toBeUndefined();
  });

  it("descarta registro sem identificador", () => {
    expect(toCandidate({ ...baseRecord, numeroControlePNCP: undefined })).toBeUndefined();
  });
});

describe("PncpClient", () => {
  it("coleta licitações, remove espelhos e não repete o mesmo certame", async () => {
    const mirror = { ...baseRecord, numeroControlePNCP: "espelho-1", dataAberturaProposta: "2026-08-07T09:30:00", dataEncerramentoProposta: "2026-08-07T09:30:00" };
    const duplicate = { ...baseRecord };
    const fetchImpl = vi.fn(async () => jsonResponse({ data: [baseRecord, mirror, duplicate], totalPaginas: 1 }));

    const client = new PncpClient({ finalDate: new Date("2027-12-31T00:00:00.000Z"), states: ["CE"], fetchImpl: fetchImpl as unknown as typeof fetch, sleepImpl: async () => {} });
    const { tenders } = await client.fetchOpenTenders();

    expect(tenders).toHaveLength(1);
    expect(tenders[0]?.externalId).toBe("07954480000179-1-000019/2026");
    expect(tenders[0]?.city).toBe("Senador Pompeu");
    expect(tenders[0]?.noticeUrl).toContain("/app/editais/");
    // uma requisição por modalidade de obra
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("consulta unidade federativa por unidade federativa quando nenhuma foi escolhida", async () => {
    const urls: string[] = [];
    const fetchImpl = vi.fn(async (url: string) => { urls.push(String(url)); return jsonResponse({ data: [], totalPaginas: 0 }); });

    const client = new PncpClient({ finalDate: new Date("2027-12-31T00:00:00.000Z"), fetchImpl: fetchImpl as unknown as typeof fetch, sleepImpl: async () => {} });
    await client.fetchOpenTenders();

    // Consulta nacional sem recorte faz o portal responder erro de banco:
    // toda requisição precisa levar a unidade federativa.
    expect(urls.every((url) => url.includes("uf="))).toBe(true);
    expect(urls).toHaveLength(brazilStates.length * workModalityCodes.length);
  });

  it("interrompe a varredura ao esgotar o tempo e registra o que ficou de fora", async () => {
    let clock = 0;
    // Cada requisição consome 100 s do orçamento de 150 s.
    const fetchImpl = vi.fn(async () => { clock += 100_000; return jsonResponse({ data: [baseRecord], totalPaginas: 1 }); });

    const client = new PncpClient({
      finalDate: new Date("2027-12-31T00:00:00.000Z"),
      states: ["CE", "RN", "SP"],
      budgetMs: 150_000,
      nowImpl: () => clock,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleepImpl: async () => {},
    });
    const { tenders, failures } = await client.fetchOpenTenders();

    expect(tenders).toHaveLength(1);
    expect(failures.length).toBeGreaterThan(0);
    // O que foi consultado antes do prazo continua valendo; o resto vira pendência.
    expect(fetchImpl.mock.calls.length).toBeLessThan(9);
  });

  /**
   * Regressão do 504 de 28/08/2026: o portal recusava, a página entrava na
   * escada de novas tentativas e o prazo só era consultado ENTRE páginas, então
   * uma única página segurava a varredura por minutos. O balanceador encerrava
   * a conexão antes de qualquer resposta e a semana inteira se perdia.
   */
  it("não ultrapassa o prazo quando o portal recusa e as tentativas se acumulam", async () => {
    let clock = 0;
    // Cada tentativa gasta 30 s e sempre falha, forçando a escada de reenvio.
    const fetchImpl = vi.fn(async () => { clock += 30_000; return new Response("indisponível", { status: 503 }); });

    const client = new PncpClient({
      finalDate: new Date("2027-12-31T00:00:00.000Z"),
      states: ["CE", "RN", "SP"],
      budgetMs: 150_000,
      nowImpl: () => clock,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleepImpl: async (ms) => { clock += ms; },
    });

    const { tenders, failures } = await client.fetchOpenTenders();

    expect(tenders).toHaveLength(0);
    expect(failures.length).toBeGreaterThan(0);
    // O essencial: para dentro do prazo em vez de rodar por minutos a fio.
    expect(clock).toBeLessThanOrEqual(150_000 + 30_000);
  });

  it("segue a varredura quando uma unidade federativa falha", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (String(url).includes("uf=RN")) return new Response("Erro na comunicação com o banco de dados.", { status: 500 });
      return jsonResponse({ data: [baseRecord], totalPaginas: 1 });
    });

    const client = new PncpClient({ finalDate: new Date("2027-12-31T00:00:00.000Z"), states: ["CE", "RN"], fetchImpl: fetchImpl as unknown as typeof fetch, sleepImpl: async () => {} });
    const { tenders, failures } = await client.fetchOpenTenders();

    expect(tenders).toHaveLength(1);
    expect(failures).toEqual(["RN/4", "RN/5", "RN/2"]);
  });

  it("reenvia a requisição quando o portal responde 429", async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      if (calls === 1) return new Response("", { status: 429 });
      return jsonResponse({ data: [baseRecord], totalPaginas: 1 });
    });

    const client = new PncpClient({ finalDate: new Date("2027-12-31T00:00:00.000Z"), fetchImpl: fetchImpl as unknown as typeof fetch, sleepImpl: async () => {} });
    const { tenders } = await client.fetchOpenTenders();

    expect(tenders).toHaveLength(1);
    expect(calls).toBeGreaterThan(3);
  });

  it("restringe a consulta às unidades federativas configuradas", async () => {
    const urls: string[] = [];
    const fetchImpl = vi.fn(async (url: string) => {
      urls.push(String(url));
      return jsonResponse({ data: [], totalPaginas: 0 });
    });

    const client = new PncpClient({
      finalDate: new Date("2027-12-31T00:00:00.000Z"),
      states: ["CE", "RN"],
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleepImpl: async () => {},
    });
    await client.fetchOpenTenders();

    expect(urls.some((url) => url.includes("uf=CE"))).toBe(true);
    expect(urls.some((url) => url.includes("uf=RN"))).toBe(true);
  });
});
