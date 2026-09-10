import type { Adherence } from "@/modules/scouting/domain/adherence";
import type { ArchiveAdherence } from "@/modules/scouting/domain/archive-adherence";

/**
 * Aderência ao perfil, combinada com o acervo.
 *
 * "Aderência ao perfil" respondia só "isto é o tipo de obra que buscamos?"
 * (tipo, valor, prazo, esfera — uma lista configurada). Mas perfil é via de
 * mão dupla: não basta ser o que buscamos, tem que ser o que atendemos de
 * verdade. Uma licitação podia bater 100% nas quatro preferências e não ter
 * acervo nenhum que a sustente — e a tela dizia 100% mesmo assim, o que é
 * mentira pela metade que decide habilitação.
 *
 * As duas metades pesam igual, de propósito: nenhuma decide sozinha se vale a
 * pena — é a mesma razão pela qual o porte não entra na nota do acervo
 * (ver `archive-adherence.ts`), só que aqui as duas metades SÃO o número.
 *
 * ⚠️ Isto NÃO substitui a nota de pré-requisitos (que já junta acervo, porte,
 * prazo, valor e condições do edital, e é o que ordena e filtra a fila hoje).
 * É só o texto "Aderência ao perfil" do painel deixando de mentir sozinho.
 */
const PROFILE_WEIGHT = 50;
const ARCHIVE_WEIGHT = 50;

export type CombinedAdherence = Readonly<{
  /** 0 a 100. */
  score: number;
  /**
   * Falso enquanto o acervo não pôde ser julgado (sem tipo reconhecido ou sem
   * nada cadastrado) — falta a metade da conta que decide habilitação, e o
   * número nunca finge estar completo enquanto isso.
   */
  determined: boolean;
}>;

export function combineAdherence(profile: Adherence, archive: ArchiveAdherence): CombinedAdherence {
  const profileScore = profile.undetermined ? 0 : profile.score;

  if (!archive.determined) {
    // Sem acervo julgado, o número vale só a metade do perfil — nunca fecha
    // 100, porque a outra metade da pergunta ("atendemos isto?") não foi
    // respondida ainda.
    return { score: Math.round(profileScore * (PROFILE_WEIGHT / 100)), determined: false };
  }

  return {
    score: Math.round((profileScore * PROFILE_WEIGHT + archive.score * ARCHIVE_WEIGHT) / 100),
    determined: true,
  };
}
