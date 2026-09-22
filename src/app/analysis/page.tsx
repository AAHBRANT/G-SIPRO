import { authorize } from "@/core/authorization/policy";
import { getCurrentAuthorizationContext } from "@/core/authorization/authorization-context";
import { PrismaFunilRepository } from "@/modules/analysis/infrastructure/prisma-funil-repository";
import { PrismaTerritorioRepository } from "@/modules/analysis/infrastructure/prisma-territorio-repository";
import { AnalisePainel } from "@/app/analysis/analise-painel";
import "./analise.css";

export const dynamic = "force-dynamic";

export const metadata = { title: "Análise · G-SIPRO" };

/** Seis meses fechados mais o mês corrente — o recorte fino é feito na tela. */
const JANELA_EM_MESES = 6;

function janelaDoPeriodo(agora: Date) {
  const ate = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() + 1, 1));
  const de = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() + 1 - JANELA_EM_MESES, 1));
  return { de, ate };
}

/**
 * Análise — funil comercial do G-SIPRO.
 *
 * Funcionalidade própria do sistema, não do Buscador: ela cruza a varredura
 * com triagem, estudo e proposta, que vivem em módulos diferentes.
 *
 * ⚠️ A agregação é feita no banco, por mês, e só o resumo atravessa para o
 * cliente. Trazer licitação por licitação para somar no navegador não escala
 * e ainda obrigaria a repetir a mesma conta em cada bloco da tela.
 */
export default async function AnalisePage() {
  const authorization = await getCurrentAuthorizationContext();
  if (!authorize(authorization, { permission: "opportunities.read" }).allowed) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center px-6 py-10">
        <section className="w-full rounded-2xl border border-amber-200 bg-amber-50 p-8">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-800">Controle de acesso</p>
          <h1 className="mt-2 text-2xl font-black text-amber-950">Acesso aguardando provisionamento</h1>
          <p className="mt-3 leading-7 text-amber-900">
            Sua identidade foi reconhecida, mas nenhum perfil aprovado concede consulta à análise comercial.
            Solicite ao administrador a atribuição do perfil adequado.
          </p>
        </section>
      </main>
    );
  }

  const agora = new Date();
  const { de, ate } = janelaDoPeriodo(agora);
  // As duas consultas são independentes e usam a mesma janela: em paralelo,
  // a página não paga a soma dos dois tempos.
  const [{ meses, semValorPorMes }, territorio] = await Promise.all([
    new PrismaFunilRepository().carregar(de, ate),
    new PrismaTerritorioRepository().carregar(de, ate),
  ]);

  const semValor = Object.values(semValorPorMes).reduce((soma, quantos) => soma + quantos, 0);
  const atualizadoEm = agora.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo",
  });

  return (
    <main className="mx-auto w-full max-w-[1180px] px-5 py-8">
      <header className="an-topo">
        <div className="an-topo-marca">
          <div>
            <p className="an-migalha"><b>G-SIPRO</b> / Análise</p>
            <h1>Análise</h1>
            <p className="an-sub">
              Inteligência comercial: o que o buscador leu no portal, o que virou oportunidade e o que virou proposta.
            </p>
          </div>
        </div>
      </header>

      {meses.length === 0
        ? (
          <p className="an-sem" style={{ marginTop: 24 }}>
            Ainda não há licitações rastreadas no período. Assim que a varredura rodar, os números aparecem aqui.
          </p>
        )
        : <AnalisePainel atualizadoEm={atualizadoEm} meses={meses} semValor={semValor} territorio={territorio}/>}
    </main>
  );
}
