import type { CSSProperties } from "react";

import Link from "next/link";

import { getCurrentAuthorizationContext } from "@/core/authorization/authorization-context";
import { authorize } from "@/core/authorization/policy";
import { getDatabase } from "@/core/database/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { computeAdherence, type AdherenceInput } from "@/modules/scouting/domain/adherence";
import { findDuplicates } from "@/modules/scouting/domain/duplicates";
import { rotulosDeEsfera as sphereLabels } from "@/modules/scouting/domain/esfera";
import { regionOf, regions, statesOfRegions } from "@/modules/scouting/domain/regions";
import { defaultScoutFilter, scoutWorkTypes, type ScoutFilter, type ScoutWorkType } from "@/modules/scouting/domain/scout-filter";
import { PrismaArchiveEvidenceRepository, PrismaScoutRepository } from "@/modules/scouting/infrastructure/prisma-scouting-repository";
import { scoreTender } from "@/modules/scouting/application/score-tender";
import { TenderDetailPanel, TenderSummaryHeader, workTypeLabels } from "./tender-detail-panel";
import { filtersBootScript, ScoutedFilters, type FilterGroup } from "./scouted-filters";
import { ThemeToggle, themeBootScript, THEME_ROOT_ID } from "./theme-toggle";
import "./scouted.css";

const PAGE_SIZE = 60;
const SHORT_DEADLINE_DAYS = 14;
/** Aderência não existe no banco: filtrar por ela obriga a trazer o conjunto e
 *  contar aqui. O teto evita que a fila cresça sem limite dentro de um pedido;
 *  quando ele é atingido a tela diz, em vez de cortar calada. */
const QUEUE_CAP = 900;
/** Abaixo disto a licitação contraria o perfil em mais de um critério. */
const OFF_PROFILE = 50;

const sortOptions = [
  { value: "aderencia", label: "Maior exigência técnica" },
  { value: "prazo", label: "Prazo mais curto" },
  { value: "valor", label: "Maior valor" },
  { value: "recente", label: "Captada mais recentemente" },
];

type Filters = Record<string, string | string[] | undefined>;
const many = (value: string | string[] | undefined): string[] => (Array.isArray(value) ? value : value ? [value] : []);
const one = (value: string | string[] | undefined): string | undefined => (Array.isArray(value) ? value[0] : value);
const digits = (value: string | undefined): number | undefined => {
  const parsed = Number((value ?? "").replace(/\D/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

/**
 * O Prisma usa `null` para ausência; o domínio da aderência usa `undefined`.
 * A conversão fica aqui, na fronteira, para o domínio não precisar conhecer a
 * convenção do banco.
 */
type AdherenceRow = Readonly<{
  subject: string;
  sphere: string;
  workTypes: readonly string[];
  estimatedValue: Prisma.Decimal | null;
  valueUndisclosed: boolean;
  proposalClosesAt: Date | null;
}>;

const toAdherenceInput = (row: AdherenceRow): AdherenceInput => ({
  subject: row.subject,
  sphere: row.sphere,
  workTypes: row.workTypes,
  estimatedValue: row.estimatedValue === null ? undefined : Number(row.estimatedValue),
  valueUndisclosed: row.valueUndisclosed,
  proposalClosesAt: row.proposalClosesAt ?? undefined,
});

async function loadFilter(): Promise<ScoutFilter> {
  // O perfil salvo manda; o padrão só cobre a base que nunca foi configurada.
  return (await new PrismaScoutRepository().loadFilter()) ?? defaultScoutFilter;
}

export default async function ScoutedTendersPage({ searchParams }: { searchParams: Promise<Filters> }) {
  const authorization = await getCurrentAuthorizationContext();
  if (!authorize(authorization, { permission: "opportunities.read" }).allowed) {
    return <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center px-6 py-10"><section className="w-full rounded-2xl border border-amber-200 bg-amber-50 p-8"><p className="text-xs font-bold uppercase tracking-wider text-amber-800">Controle de acesso</p><h1 className="mt-2 text-2xl font-black text-amber-950">Acesso aguardando provisionamento</h1><p className="mt-3 leading-7 text-amber-900">Nenhum perfil aprovado concede consulta às licitações rastreadas.</p></section></main>;
  }

  const params = await searchParams;
  const query = one(params.q)?.trim().slice(0, 120);
  const selectedRegions = many(params.reg).filter((entry) => regions.includes(entry as never));
  const selectedTypes = many(params.tipo).filter((entry) => scoutWorkTypes.includes(entry as ScoutWorkType));
  const selectedSpheres = many(params.esfera).filter((entry) => entry in sphereLabels);
  const minimumValue = digits(one(params.vmin));
  const maximumValue = digits(one(params.vmax));
  const minimumDays = digits(one(params.dmin));
  const maximumDays = digits(one(params.dmax));
  // Sigiloso entra por padrão: orçamento fechado é comum em obra grande, e
  // excluí-lo por omissão eliminaria justamente o alvo.
  const includeUndisclosed = one(params.sig) !== "0";
  const adherenceFloor = Math.max(0, Math.min(100, Number(one(params.ader) ?? 0) || 0));
  const sort = one(params.sort) ?? "aderencia";

  /**
   * Busca por texto e faixa de valor produzem, cada uma, um grupo OR. Escritas
   * como dois espalhamentos condicionais no mesmo objeto, a segunda apagava a
   * primeira em silêncio: quem buscasse texto E valor mínimo perdia a busca sem
   * nenhum aviso. Reunidas em AND, as duas valem juntas.
   */
  // Um só instante para a requisição inteira: a fila, o prazo e os cartões têm
  // de concordar sobre que horas são.
  const now = new Date();
  const groupsOfOr: Prisma.ScoutedTenderWhereInput[] = [];
  if (query) groupsOfOr.push({ OR: [{ subject: { contains: query, mode: "insensitive" } }, { authorityName: { contains: query, mode: "insensitive" } }, { city: { contains: query, mode: "insensitive" } }] });
  // A faixa de valor só se aplica a quem revelou o orçamento. Quem não
  // revelou entra ou fica de fora pela caixa "incluir valor sigiloso", nunca
  // pela faixa — senão a obra grande de orçamento fechado sumiria da fila.
  const faixaDeValor: Prisma.ScoutedTenderWhereInput[] = [];
  if (minimumValue !== undefined) faixaDeValor.push({ estimatedValue: { gte: minimumValue } });
  if (maximumValue !== undefined) faixaDeValor.push({ estimatedValue: { lte: maximumValue } });
  if (faixaDeValor.length > 0 || !includeUndisclosed) {
    const comValor: Prisma.ScoutedTenderWhereInput = faixaDeValor.length > 0
      ? { AND: [{ valueUndisclosed: false }, ...faixaDeValor] }
      : { valueUndisclosed: false };
    groupsOfOr.push(includeUndisclosed ? { OR: [comValor, { valueUndisclosed: true }] } : comValor);
  }

  // Prazo em DIAS a partir de agora, convertido para data — é assim que a
  // pessoa pensa ("quero as que encerram entre 5 e 30 dias") e é o que o banco
  // consegue comparar.
  const emDias = (dias: number) => new Date(now.getTime() + dias * 86_400_000);
  if (minimumDays !== undefined) groupsOfOr.push({ proposalClosesAt: { gte: emDias(minimumDays) } });
  if (maximumDays !== undefined) groupsOfOr.push({ proposalClosesAt: { lte: emDias(maximumDays) } });

  const states = statesOfRegions(selectedRegions);
  const where: Prisma.ScoutedTenderWhereInput = {
    status: "PENDING",
    ...(states.length > 0 && { state: { in: [...states] } }),
    ...(selectedTypes.length > 0 && { workTypes: { hasSome: selectedTypes } }),
    ...(selectedSpheres.length > 0 && { sphere: { in: selectedSpheres } }),
    ...(groupsOfOr.length > 0 && { AND: groupsOfOr }),
  };

  const orderBy: Prisma.ScoutedTenderOrderByWithRelationInput[] =
    sort === "valor" ? [{ estimatedValue: "desc" }, { proposalClosesAt: "asc" }]
    : sort === "recente" ? [{ createdAt: "desc" }]
    : [{ proposalClosesAt: "asc" }, { createdAt: "desc" }];

  const database = getDatabase();
  const shortDeadline = new Date(now.getTime() + SHORT_DEADLINE_DAYS * 86_400_000);
  const filter = await loadFilter();

  const [rows, lastRun, facets, archive, activeUsers] = await Promise.all([
    database.scoutedTender.findMany({ where, orderBy, take: QUEUE_CAP, include: { signal: true, editalReading: true } }),
    database.scoutRun.findFirst({ where: { status: "COMPLETED" }, orderBy: { startedAt: "desc" } }),
    // Projeção leve da fila inteira: alimenta os contadores dos cartões e das
    // opções de filtro sem trazer o registro completo.
    database.scoutedTender.findMany({
      where: { status: "PENDING" },
      select: { subject: true, state: true, sphere: true, workTypes: true, estimatedValue: true, valueUndisclosed: true, proposalClosesAt: true, runId: true },
    }),
    // O acervo é da empresa, não da licitação: uma consulta serve a fila
    // inteira. Buscar por linha faria centenas de idas ao banco por página.
    new PrismaArchiveEvidenceRepository().loadEvidence(),
    // Lista pequena e estável (gente ativa na casa): serve o seletor de
    // "compartilhar" de toda a fila, sem consulta por linha.
    database.user.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, displayName: true, email: true },
      orderBy: { displayName: "asc" },
    }),
  ]);
  const shareRecipients = activeUsers.map((user) => ({ id: user.id, email: user.email, label: `${user.displayName} (${user.email})` }));

  // A régua de pontuação (edital, acervo, aderência, pré-requisitos) mora em
  // score-tender.ts: é a mesma conta que a rota de detalhe de UMA licitação
  // usa para a janelinha do mapa da Análise, e as duas têm de bater.
  const comRequisitos = rows.map((tender) => scoreTender(tender, filter, archive, now));

  /**
   * O corte é pelo ACERVO, que é o critério que inabilita. Licitação cujo
   * acervo não pôde ser julgado — sem tipo reconhecido ou sem nada cadastrado —
   * fica de fora do corte em vez de virar zero, e o cabeçalho diz quantas
   * foram postas de lado. Esconder em silêncio o que não foi medido faria a
   * equipe perder obra que ela sabe fazer.
   */
  const semJulgamento = adherenceFloor > 0 ? comRequisitos.filter((tender) => !tender.archive.determined).length : 0;

  /**
   * O FILTRO corta por exigência técnica (acervo puro) e a ORDENAÇÃO ordena
   * por pré-requisitos. Divergem de propósito, não é descuido:
   *
   * - A ordem tem de bater com o número que o medidor da linha mostra
   *   (`tender.score`, desde 21/09/2026), senão a fila fica ordenada por um
   *   número que não aparece em lugar nenhum da tela.
   * - O piso continua no acervo porque licitação com edital ainda não lido
   *   tem pré-requisitos baixos por FALTA DE DADO. Um piso contra esse número
   *   esconderia justamente o represado que ainda precisa ser lido.
   */
  const kept = adherenceFloor > 0
    ? comRequisitos.filter((tender) => tender.archive.score >= adherenceFloor)
    : comRequisitos;
  const ordered = sort === "aderencia"
    ? [...kept].sort((a, b) => b.score - a.score
        // Empate em pré-requisitos: decide o acervo, e sem acervo julgado vai
        // para o fim — é dado que falta, não zero de verdade.
        || (b.archive.determined ? b.archive.score : -1) - (a.archive.determined ? a.archive.score : -1))
    : kept;
  const tenders = ordered.slice(0, PAGE_SIZE);

  /**
   * Mesma obra publicada mais de uma vez. Roda sobre a fila inteira, e não
   * sobre a página: a irmã da linha visível costuma estar na página seguinte,
   * e um aviso que só aparece quando as duas caem juntas na tela não serve.
   */
  const duplicadas = findDuplicates(kept.map((tender) => ({
    id: tender.id,
    ...(tender.authorityDocument ? { authorityDocument: tender.authorityDocument } : {}),
    authorityName: tender.authorityName,
    ...(tender.processNumber ? { processNumber: tender.processNumber } : {}),
    subject: tender.subject,
  })));

  const facetScores = facets.map((entry) => computeAdherence(toAdherenceInput(entry), filter, now));
  const total = facets.length;
  const offProfile = facetScores.filter((entry) => entry.score < OFF_PROFILE).length;

  const groups: FilterGroup[] = [
    { key: "reg", label: "Região", options: regions.map((region) => ({ value: region, label: region, count: facets.filter((entry) => regionOf(entry.state) === region).length })) },
    { key: "tipo", label: "Tipo de obra", options: scoutWorkTypes.map((type) => ({ value: type, label: workTypeLabels[type], count: facetScores.filter((entry) => entry.workTypes.includes(type)).length })) },
    { key: "esfera", label: "Esfera", options: Object.entries(sphereLabels).map(([value, label]) => ({ value, label, count: facets.filter((entry) => entry.sphere === value).length })) },
  ];

  const canDecide = authorize(authorization, { permission: "opportunities.create" }).allowed;
  const truncated = rows.length === QUEUE_CAP;

  return <div className="bx" id={THEME_ROOT_ID}>
    {/* Aplica o tema salvo antes da pintura, para a tela não piscar no claro
        antes de virar escura. */}
    <script dangerouslySetInnerHTML={{ __html: themeBootScript }}/>
    {/* Idem, para a barra de filtros recolhida — sem isto ela sempre nasceria
        aberta e só recolheria um instante depois. */}
    <script dangerouslySetInnerHTML={{ __html: filtersBootScript }}/>

    <div className="mx-auto w-full max-w-[1560px] px-4 py-6 sm:px-6 lg:px-8">
    <Link className="bx-voltar" href="/opportunities">← Voltar às oportunidades</Link>

    <header className="bx-topo" style={{ marginTop: 10 }}>
      <div>
        <p className="bx-sobrenome">Buscador G-SIPRO</p>
        <h1 className="bx-titulo">Oportunidades rastreadas</h1>
        <p className="bx-sub">Captadas na varredura de domingo. Aprovar cadastra a oportunidade automaticamente; descartar guarda no histórico.</p>
      </div>
      <ThemeToggle/>
    </header>

    <section aria-label="Resumo da fila" className="bx-cartoes">
      <Cartao dica="aguardando decisão" rotulo="Na fila" valor={total}/>
      <Cartao dica={lastRun ? `varredura de ${lastRun.startedAt.toLocaleDateString("pt-BR")}` : "nenhuma varredura concluída"} rotulo="Novas nesta semana" valor={lastRun ? facets.filter((entry) => entry.runId === lastRun.id).length : 0}/>
      <Cartao destaque dica={`aderência abaixo de ${OFF_PROFILE}%`} rotulo="Fora do perfil" valor={offProfile}/>
      <Cartao dica={`encerram em até ${SHORT_DEADLINE_DAYS} dias`} rotulo="Prazo curto" valor={facets.filter((entry) => entry.proposalClosesAt && entry.proposalClosesAt <= shortDeadline).length}/>
      <Cartao dica="orçamento fechado pelo órgão" rotulo="Valor sigiloso" valor={facets.filter((entry) => entry.valueUndisclosed).length}/>
    </section>

    {/* Duas colunas: filtros à esquerda, lista à direita. A sidebar fica FORA
        da mesa — dentro dela a rolagem própria não funcionaria, porque a mesa
        tem overflow:hidden. */}
    <div className="bx-palco">
      <ScoutedFilters groups={groups} sortOptions={sortOptions}/>

      <div>
    <section className="bx-mesa">
      <header className="bx-relacao">
        <h2>
          Relação de rastreadas
          <span className="total">{kept.length === total ? total : `${kept.length} de ${total}`}</span>
        </h2>
        <p>
          {kept.length > tenders.length && <>Mostrando as <strong>{tenders.length}</strong> primeiras · </>}
          {semJulgamento > 0 && <><strong>{semJulgamento}</strong> fora do corte por acervo não julgado · </>}
          {truncated && <>Fila maior que {QUEUE_CAP}; a contagem por exigência técnica considera as {QUEUE_CAP} primeiras · </>}
          Ordenado por <strong>{sortOptions.find((option) => option.value === sort)?.label.toLowerCase()}</strong>
        </p>
      </header>

      <div>
        {tenders.map((tender) => {
          const signal = tender.signal;
          return <details
            className="bx-linha"
            data-sinalizada={signal ? "sim" : undefined}
            id={tender.id}
            key={tender.id}
            style={signal ? ({ "--sig-claro": signal.light, "--sig-escuro": signal.dark } as CSSProperties) : undefined}
          >
            <summary className="bx-cab">
              {/* Faixa e bandeira ficam DENTRO do summary: soltas no details o
                  navegador as trata como conteúdo do detalhe e joga para o rodapé. */}
              <svg aria-hidden="true" className="bx-seta h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>
              <TenderSummaryHeader
                canDecide={canDecide}
                duplicateCount={duplicadas.get(tender.id)?.length ?? 0}
                shareRecipients={shareRecipients}
                tender={tender}
              />
            </summary>

            <div className="bx-painel">
              <TenderDetailPanel tender={tender}/>
            </div>
          </details>;
        })}

        {tenders.length === 0 && <div className="bx-vazio">
          <p>{total === 0 ? "Nenhuma licitação aguardando triagem" : "Nada com esses filtros"}</p>
          <span>{total === 0 ? "A próxima varredura ocorre no domingo." : "Baixe a exigência técnica mínima ou desmarque alguma região."}</span>
        </div>}
      </div>
        </section>
      </div>
    </div>
    </div>
  </div>;
}

function Cartao({ rotulo, valor, dica, destaque }: { rotulo: string; valor: number; dica: string; destaque?: boolean }) {
  return <article className={destaque && valor > 0 ? "bx-cartao destaque" : "bx-cartao"}>
    <p className="rot">{rotulo}</p>
    <p className="num">{valor}</p>
    <p className="dica">{dica}</p>
  </article>;
}

