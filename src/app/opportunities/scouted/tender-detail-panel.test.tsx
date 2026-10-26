import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AppRouterContext, type AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { PathnameContext, SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";

import { TenderDetailPanel } from "@/app/opportunities/scouted/tender-detail-panel";
import { scoreTender, type ScoutedTenderRow } from "@/modules/scouting/application/score-tender";
import { defaultScoutFilter } from "@/modules/scouting/domain/scout-filter";

/**
 * Visual de 22/10/2026: abas mantidas, cada uma em grade simétrica, listas
 * com ícone e rodapé com atalhos em qualquer aba. O teste pega o que
 * quebraria em silêncio — célula faltando na grade, rodapé sumindo, CNPJ sem
 * máscara, prazo na faixa errada.
 */
const roteador = { back() {}, forward() {}, refresh() {}, push() {}, replace() {}, prefetch() {} } as unknown as AppRouterInstance;
const agora = new Date("2026-10-22T12:00:00-03:00");

function linha(overrides: Partial<ScoutedTenderRow> = {}): ScoutedTenderRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    externalId: "76105675000167-1-000193/2026",
    source: "PNCP",
    subject: "Construção de unidade básica de saúde porte III no Jardim Alvorada",
    authorityName: "MUNICIPIO DE MARINGA",
    authorityDocument: "76282656000106",
    sphere: "M",
    city: "Maringá",
    state: "PR",
    modality: "Concorrência - Eletrônica",
    workTypes: ["EDIFICACAO"],
    processNumber: "2026/193",
    estimatedValue: 14_800_000 as never,
    valueUndisclosed: false,
    proposalOpensAt: new Date("2026-11-28T12:00:00-03:00"),
    proposalClosesAt: new Date("2026-11-27T18:00:00-03:00"),
    noticeUrl: "https://pncp.gov.br/app/editais/76282656000106/2026/193",
    sourceUrl: null,
    status: "PENDING",
    decidedAt: null,
    decidedById: null,
    decisionReason: null,
    opportunityId: null,
    runId: "22222222-2222-4222-8222-222222222222",
    createdAt: new Date("2026-10-18T09:00:00-03:00"),
    signal: null,
    editalReading: null,
    ...overrides,
  } as ScoutedTenderRow;
}

function render(row = linha()) {
  const tender = scoreTender(row, defaultScoutFilter, [], agora);
  return renderToStaticMarkup(<AppRouterContext.Provider value={roteador}>
    <PathnameContext.Provider value="/opportunities/scouted">
      <SearchParamsContext.Provider value={new URLSearchParams() as never}>
        <TenderDetailPanel tender={tender}/>
      </SearchParamsContext.Provider>
    </PathnameContext.Provider>
  </AppRouterContext.Provider>);
}

describe("TenderDetailPanel em grade", () => {
  it("Identificação abre em grade de 8 células (4 × 2), com CNPJ mascarado", () => {
    const html = render();
    const identificacao = html.slice(html.indexOf('id="11111111-1111-4111-8111-111111111111-p1"'), html.indexOf('id="11111111-1111-4111-8111-111111111111-p2"'));
    expect(identificacao.match(/class="bx-item"/g)).toHaveLength(8);
    expect(identificacao).toContain("<dt>Valor estimado</dt><dd>R$");
    expect(identificacao).toContain("76.282.656/0001-06");
  });

  it("Prazos fica em grade de 4 e destaca dias restantes só quando o prazo é curto", () => {
    const folgado = render();
    const prazos = folgado.slice(folgado.indexOf('id="11111111-1111-4111-8111-111111111111-p2"'), folgado.indexOf('id="11111111-1111-4111-8111-111111111111-p3"'));
    expect(prazos.match(/class="bx-item"/g)).toHaveLength(4);
    expect(prazos).not.toContain('class="curto"');

    const curto = render(linha({ proposalClosesAt: new Date("2026-10-30T18:00:00-03:00") }));
    expect(curto).toMatch(/<dt>Dias restantes.*?<\/dt><dd class="curto">/);
  });

  /**
   * Pedido do Junior (26/10/2026): "Início do recebimento" antes do "Prazo
   * final" confundia — ele achou que a entrega vinha depois da abertura. Cada
   * data de Prazos explica o que é ao passar o mouse.
   */
  it("cada data de Prazos explica o que é ao passar o mouse", () => {
    const html = render();
    const prazos = html.slice(html.indexOf('id="11111111-1111-4111-8111-111111111111-p2"'), html.indexOf('id="11111111-1111-4111-8111-111111111111-p3"'));
    expect(prazos.match(/role="tooltip"/g)).toHaveLength(4);
    expect(prazos).toContain('aria-label="O que é Início do recebimento?"');
    expect(prazos).toContain("não é a sessão de disputa");
    expect(prazos).toContain("Último dia para enviar a proposta");
  });

  it("pré-requisitos e aderência vêm em lista com ícone", () => {
    const html = render();
    expect(html.match(/class="bx-checklist"/g)).toHaveLength(2);
  });

  it("rodapé com os atalhos e o selo do prazo aparece fora das abas", () => {
    const html = render();
    const rodape = html.slice(html.indexOf('class="bx-rodape-ficha"'));
    expect(rodape).toContain("Abrir no PNCP");
    expect(rodape).toContain(">Ver no mapa</a>");
    expect(rodape).toContain("/opportunities/scouted?uf=PR#mapa");
    expect(rodape).toContain('class="bx-ficha-prazo folgado">Prazo folgado</span>');
  });
});
