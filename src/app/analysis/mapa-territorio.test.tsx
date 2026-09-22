import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MapaTerritorio } from "@/app/analysis/mapa-territorio";
import { UNIDADES_FEDERATIVAS } from "@/modules/analysis/domain/malha-uf";
import { projetar, type CelulaTerritorial, type LicitacaoDoRecorte, type MunicipioNoMapa } from "@/modules/analysis/domain/territorio";
import { acharMunicipio } from "@/modules/analysis/infrastructure/municipios-brasil";

/**
 * Render do servidor: pega o estado inicial da tela, que é o que todo mundo
 * vê ao abrir. Cobre o que quebraria em silêncio — largura de barra inválida,
 * número desconhecido virando zero, aviso de escopo sumindo, ponto no lugar
 * errado.
 */

const celula = (
  uf: string | null,
  cidade: string | null,
  esfera: string,
  aderentes: number,
  valor: number | null,
): CelulaTerritorial => ({
  mes: "2026-09-01",
  uf,
  cidade,
  esfera,
  quantidade: {
    aderentes,
    aprovadas: Math.floor(aderentes / 2),
    orcamento: Math.floor(aderentes / 4),
    propostas: Math.floor(aderentes / 8),
  },
  valor: {
    aderentes: valor,
    aprovadas: valor === null ? null : valor / 2,
    orcamento: valor === null ? null : valor / 4,
    propostas: valor === null ? null : valor / 8,
  },
  semValor: valor === null ? aderentes : 0,
});

const MESES = new Set(["2026-09-01"]);

const BASE: readonly CelulaTerritorial[] = [
  celula("MG", "Belo Horizonte", "M", 64, 42_000_000),
  celula("SP", "São Paulo", "M", 31, 28_000_000),
  celula("BA", "Salvador", "M", 18, 9_500_000),
  celula("RS", "Porto Alegre", "E", 7, 3_100_000),
  celula("DF", "Brasília", "D", 4, 2_200_000),
  celula("PA", "Belém", "F", 3, null),
];

/** Resolvidos como o servidor resolve, pela base real. */
const MUNICIPIOS: readonly MunicipioNoMapa[] = ["Belo Horizonte|MG", "São Paulo|SP", "Salvador|BA", "Porto Alegre|RS", "Brasília|DF", "Belém|PA"]
  .map((par) => {
    const [nome, uf] = par.split("|") as [string, string];
    const achado = acharMunicipio(nome, uf);
    if (!achado) throw new Error(`municipio de teste fora da base: ${par}`);
    return { chave: `${achado.chave}|${uf}`, nome, uf, ibge: achado.ibge, latitude: achado.latitude, longitude: achado.longitude };
  });

const registro = (parcial: Partial<LicitacaoDoRecorte> = {}): LicitacaoDoRecorte => ({
  id: "1",
  identificador: "01612516000150-1-000304/2026",
  objeto: "Execução de rede coletora de esgoto",
  uf: "MG",
  cidade: "Belo Horizonte",
  esfera: "M",
  autoridade: "Prefeitura Municipal",
  captadaEm: "2026-09-10T12:00:00.000Z",
  fechaEm: null,
  valor: 4_200_000,
  aprovada: true,
  estudoConcluido: false,
  propostaEnviada: false,
  ...parcial,
});

const REGISTROS = [
  registro({ id: "1" }),
  registro({ id: "2", uf: "SP", cidade: "São Paulo", esfera: "F", valor: null, aprovada: false }),
  registro({ id: "3", uf: "PA", cidade: "Belém", esfera: "F", propostaEnviada: true, estudoConcluido: true }),
];

const render = (
  celulas: readonly CelulaTerritorial[] = BASE,
  medida: "qtd" | "val" = "qtd",
  extras: Partial<{ municipios: readonly MunicipioNoMapa[]; registros: readonly LicitacaoDoRecorte[]; registrosCortados: boolean }> = {},
) =>
  renderToStaticMarkup(
    <MapaTerritorio
      celulas={celulas}
      medida={medida}
      meses={MESES}
      municipios={extras.municipios ?? MUNICIPIOS}
      registros={extras.registros ?? REGISTROS}
      registrosCortados={extras.registrosCortados ?? false}
    />,
  );

describe("mapa do território", () => {
  const html = render();

  it("desenha as 27 unidades da federação", () => {
    expect(html.match(/class="an-uf /g) ?? []).toHaveLength(UNIDADES_FEDERATIVAS.length);
  });

  /**
   * Largura inválida é descartada pelo navegador e a barra aparece CHEIA:
   * "não sei" ficaria idêntico a "o máximo possível".
   */
  it("nenhuma largura inválida escapa para o HTML", () => {
    expect(html).not.toMatch(/width:\s*(NaN|Infinity|-)/);
  });

  it("não imprime NaN nem Infinity", () => {
    const semComentarios = html.replace(/<!--[\s\S]*?-->/g, "");
    expect(semComentarios).not.toContain("NaN");
    expect(semComentarios).not.toContain("Infinity");
  });

  /** Sem este aviso, quem filtra "Sul" e vê o card nacional igual acha que quebrou. */
  it("avisa que os filtros daqui não mexem nos cards do topo", () => {
    expect(html).toContain("os cards do topo continuam nacionais");
  });

  /** Afirmar que é o local da obra seria dizer o que o dado não sustenta. */
  it("diz que a localização é a sede do órgão", () => {
    expect(html).toContain("sede do órgão que publicou");
  });

  /** "Universo" sem explicação convida a ler como "o mercado inteiro". */
  it("explica que universo é o que o buscador achou", () => {
    expect(html).toContain("é tudo que o buscador achou no período, não o mercado inteiro");
  });

  it("o líder do ranking aparece em primeiro", () => {
    const lista = html.slice(html.indexOf("<ol"), html.indexOf("</ol>"));
    const posicao = (sigla: string) => lista.indexOf(`${sigla} ·`);
    expect(posicao("MG")).toBeGreaterThan(-1);
    expect(posicao("MG")).toBeLessThan(posicao("SP"));
    expect(posicao("SP")).toBeLessThan(posicao("BA"));
  });

  /** Esconder quem tem zero tira a informação de onde a empresa NÃO está. */
  it("o ranking lista as 27 unidades, não só as que têm licitação", () => {
    const lista = html.slice(html.indexOf("<ol"), html.indexOf("</ol>"));
    expect(lista).toContain("AC · Acre");
    expect(lista).toContain("RR · Roraima");
  });

  it("as cinco regiões aparecem, inclusive as vazias", () => {
    for (const regiao of ["Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul"]) {
      expect(html).toContain(regiao);
    }
  });

  it("o estado com mais licitações recebe o tom mais escuro", () => {
    expect(html).toMatch(/class="an-uf n5"[^>]*>\s*<title>Minas Gerais/);
  });

  it("estado sem licitação fica no nível vazio, não indisponível", () => {
    expect(html).toMatch(/class="an-uf n0"[^>]*>\s*<title>Acre: sem ocorrência/);
  });

  it("a escala do mapa mostra o máximo, não só 'menos' e 'mais'", () => {
    expect(html).toContain("an-mapa-escala");
    expect(html).toContain(">64<");
  });

  it("as quatro esferas aparecem numeradas", () => {
    for (const rotulo of ["Federal", "Estadual", "Municipal", "Distrital"]) expect(html).toContain(rotulo);
    expect(html).toContain(">01<");
    expect(html).toContain(">04<");
  });

  it("a frase de destaque nomeia o líder e o que falta virar proposta", () => {
    expect(html).toMatch(/MG · Minas Gerais lidera este recorte com 64/);
    expect(html).toContain("ainda não têm proposta enviada");
  });
});

describe("pontos dos municípios", () => {
  const html = render();

  it("desenha um ponto por município com licitação", () => {
    expect(html.match(/class="an-ponto"/g) ?? []).toHaveLength(MUNICIPIOS.length);
  });

  it("o ponto avisa que é a sede do município, não o endereço da licitação", () => {
    expect(html).toContain("sede do município");
    expect(html).toContain("não endereços das licitações");
  });

  /** O ponto tem de cair na coordenada certa, e a projeção é a prova disso. */
  it("o ponto de Belo Horizonte fica na coordenada projetada da cidade", () => {
    const bh = acharMunicipio("Belo Horizonte", "MG");
    expect(bh).toBeDefined();
    const { x, y } = projetar(bh!.latitude, bh!.longitude);
    expect(html).toContain(`translate(${x.toFixed(1)},${y.toFixed(1)})`);
  });

  it("município sem coordenada conhecida não vira ponto e não quebra a tela", () => {
    const html2 = render(BASE, "qtd", { municipios: [] });
    expect(html2).not.toContain('class="an-ponto"');
    expect(html2).not.toContain("NaN");
  });
});

describe("medida em reais", () => {
  const html = render(BASE, "val");

  /**
   * Orçamento sigiloso é o caso real: o Pará tem licitação e não tem valor.
   * Em reais ele não pode virar "R$ 0" nem sumir do aviso.
   */
  it("estado com licitação e sem valor fica indisponível, com hachura", () => {
    expect(html).toMatch(/class="an-uf nx"[^>]*>\s*<title>Pará/);
    expect(html).toContain("an-hachura");
  });

  it("conta as licitações que ficaram fora da soma em reais", () => {
    expect(html).toContain("não informaram valor estimado");
  });
});

describe("lista de licitações do recorte", () => {
  const html = render();

  it("mostra as licitações com identificador, local e etapa", () => {
    expect(html).toContain("01612516000150-1-000304/2026");
    expect(html).toContain("Belo Horizonte");
    expect(html).toContain("Participamos");
  });

  it("valor não informado aparece como traço, não como zero", () => {
    const linhas = html.slice(html.indexOf("an-licitacoes"));
    expect(linhas).toContain("—");
    expect(linhas).not.toContain("R$ 0");
  });

  it("avisa quando a lista não traz tudo", () => {
    expect(render(BASE, "qtd", { registrosCortados: true })).toContain("o recorte tem mais do que cabe aqui");
    expect(html).not.toContain("o recorte tem mais do que cabe aqui");
  });

  it("recorte sem licitação nenhuma mostra recado", () => {
    expect(render(BASE, "qtd", { registros: [] })).toContain("Nenhuma licitação neste recorte territorial");
  });
});

describe("casos que não podem quebrar a tela", () => {
  it("período sem licitação nenhuma mostra recado, não tela vazia", () => {
    const html = render([]);
    expect(html).toContain("Nenhuma licitação neste recorte de período");
    expect(html).not.toContain("NaN");
  });

  it("licitação sem estado informado é dita, não escondida", () => {
    const html = render([...BASE, celula(null, null, "M", 5, 1_000_000)]);
    expect(html).toContain("sem estado informado no portal");
  });

  it("uma única licitação não produz escala inválida", () => {
    const html = render([celula("RR", "Boa Vista", "M", 1, 1)]);
    expect(html).not.toContain("NaN");
    expect(html).toMatch(/class="an-uf n5"[^>]*>\s*<title>Roraima/);
  });
});
