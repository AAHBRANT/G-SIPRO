import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  SignalNotFoundError,
  SignalService,
  TenderAlreadyDecidedError,
  TenderNotFoundError,
  type SignalRecord,
  type SignalRepository,
} from "@/modules/scouting/application/signal-service";

const AGORA = new Date("2026-08-28T15:00:00.000Z");
const ATOR = "11111111-1111-1111-1111-111111111111";

function repositorioFalso(status: string | null = "PENDING") {
  const gravados: SignalRecord[] = [];
  let existe = true;
  const repository: SignalRepository = {
    findTenderStatus: vi.fn(async () => (status === null ? null : { status })),
    save: vi.fn(async (record) => { gravados.push(record); }),
    remove: vi.fn(async () => existe),
  };
  return { repository, gravados, semSinal: () => { existe = false; } };
}

describe("SignalService.signal", () => {
  let falso: ReturnType<typeof repositorioFalso>;
  let service: SignalService;

  beforeEach(() => {
    falso = repositorioFalso();
    service = new SignalService(falso.repository, () => AGORA);
  });

  it("finca a marca de um nível fixo com o rótulo do próprio nível", async () => {
    const resolved = await service.signal("t1", { level: "HIGH" }, ATOR);

    expect(resolved.label).toBe("Prioridade alta");
    expect(falso.gravados).toHaveLength(1);
    expect(falso.gravados[0]).toMatchObject({ tenderId: "t1", level: "HIGH", label: "Prioridade alta", signaledById: ATOR, signaledAt: AGORA });
  });

  it("devolve as duas variantes de cor, para quem chamou desenhar sem nova consulta", async () => {
    const resolved = await service.signal("t1", { level: "MEDIUM" }, ATOR);
    expect(resolved.light).toMatch(/^#[0-9a-f]{6}$/);
    expect(resolved.dark).toMatch(/^#[0-9a-f]{6}$/);
    expect(resolved.light).not.toBe(resolved.dark);
  });

  it("grava a cor ESCOLHIDA, não a variante desenhada", async () => {
    // As variantes derivam a cada leitura; gravá-las congelaria a regra de
    // contraste no estado em que ela estava no dia da gravação.
    await service.signal("t1", { level: "CUSTOM", label: "aguardando acervo", color: "#6B3FA0" }, ATOR);
    expect(falso.gravados[0]?.color).toBe("#6b3fa0");
  });

  it("guarda a observação quando ela vem", async () => {
    await service.signal("t1", { level: "LOW", note: "obra pequena, olhar depois" }, ATOR);
    expect(falso.gravados[0]?.note).toBe("obra pequena, olhar depois");
  });

  it("não inventa observação quando ela não vem", async () => {
    await service.signal("t1", { level: "LOW" }, ATOR);
    expect(falso.gravados[0]).not.toHaveProperty("note");
  });

  it("recusa licitação inexistente", async () => {
    const vazio = repositorioFalso(null);
    const semNada = new SignalService(vazio.repository, () => AGORA);
    await expect(semNada.signal("sumida", { level: "HIGH" }, ATOR)).rejects.toBeInstanceOf(TenderNotFoundError);
    expect(vazio.repository.save).not.toHaveBeenCalled();
  });

  it.each(["APPROVED", "DISCARDED", "EXPIRED"])("recusa sinalizar licitação já %s", async (status) => {
    const fora = repositorioFalso(status);
    const decidida = new SignalService(fora.repository, () => AGORA);
    // Marcar o que saiu da fila não orienta ninguém: a linha não aparece mais.
    await expect(decidida.signal("t1", { level: "HIGH" }, ATOR)).rejects.toBeInstanceOf(TenderAlreadyDecidedError);
    expect(fora.repository.save).not.toHaveBeenCalled();
  });

  it("sinalizar de novo substitui a marca e registra o novo autor", async () => {
    const OUTRO = "22222222-2222-2222-2222-222222222222";
    await service.signal("t1", { level: "LOW" }, ATOR);
    await service.signal("t1", { level: "HIGH" }, OUTRO);

    expect(falso.gravados).toHaveLength(2);
    expect(falso.gravados[1]).toMatchObject({ tenderId: "t1", level: "HIGH", signaledById: OUTRO });
  });
});

describe("SignalService.unsignal", () => {
  it("remove a marca existente", async () => {
    const falso = repositorioFalso();
    const service = new SignalService(falso.repository, () => AGORA);
    await expect(service.unsignal("t1")).resolves.toBeUndefined();
    expect(falso.repository.remove).toHaveBeenCalledWith("t1");
  });

  it("avisa quando não havia marca para remover, em vez de fingir sucesso", async () => {
    const falso = repositorioFalso();
    falso.semSinal();
    const service = new SignalService(falso.repository, () => AGORA);
    await expect(service.unsignal("t1")).rejects.toBeInstanceOf(SignalNotFoundError);
  });
});
