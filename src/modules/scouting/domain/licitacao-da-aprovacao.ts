/**
 * Monta o rascunho da LICITAÇÃO que nasce quando a triagem aprova.
 *
 * Até 22/09/2026 aprovar criava só a oportunidade, e quem fosse trabalhar nela
 * redigitava à mão número do processo, modalidade e os documentos — tudo dado
 * que o PNCP já tinha entregue na varredura. O pedido do dono foi direto:
 * "ao ser aprovada ela já virar oportunidade", com "o arquivo do edital e os
 * anexos já vinculados na ficha da licitação".
 *
 * ⚠️ Os BYTES não ficam guardados no G-SIPRO — decisão do dono em 22/09/2026.
 * A ficha guarda nome, endereço no portal, tamanho e o SHA-256 de cada
 * arquivo. O hash é o que faz esse registro valer alguma coisa: é ele que
 * denuncia edital retificado depois da aprovação, quando o link continua o
 * mesmo e o conteúdo mudou.
 *
 * Esta camada não fala com a rede: recebe os arquivos já baixados e conferidos
 * e devolve o rascunho. Quem baixa é o serviço de aplicação.
 */
import type { PncpIdentifier } from "@/modules/scouting/domain/pncp-identifier";

export type ArquivoConferido = Readonly<{
  titulo: string;
  /** Tipo declarado pelo órgão: "Edital", "Termo de Referência", "Anexo"… */
  documentType: string;
  fileName: string;
  fileHash: string;
  uri: string;
  mimeType: string;
  sizeBytes: number;
}>;

export type DadosDaFila = Readonly<{
  externalId: string;
  subject: string;
  modality: string;
  processNumber?: string;
  noticeUrl?: string;
  opportunityId: string;
  contractingAuthorityId?: string;
}>;

export type RascunhoDeLicitacao = Readonly<{
  tender: Record<string, unknown>;
  version: Record<string, unknown>;
}>;

/**
 * Código legível e estável, derivado do identificador do portal.
 *
 * Tem de ser único (o banco exige) e reproduzível: aprovar a mesma licitação
 * duas vezes não pode gerar dois códigos diferentes para o mesmo edital. O
 * identificador do PNCP já é único por contratação, então serve de raiz.
 */
export function codigoDaLicitacao(identificador: PncpIdentifier): string {
  const sequencial = String(identificador.sequence).padStart(6, "0");
  return `PNCP-${identificador.authorityDocument}-${sequencial}-${identificador.year}`;
}

/**
 * Escolhe qual documento é o EDITAL da ficha.
 *
 * ⚠️ NÃO é a mesma escolha de `edital-relevance`. Aquela régua responde "o que
 * a IA deve ler para achar as parcelas com quantitativo", e por isso coloca o
 * Termo de Referência na frente do EDITAL.pdf. Aqui a pergunta é outra: qual
 * documento uma pessoa espera ver como "o edital" ao abrir a ficha. Medido em
 * 22/09/2026 numa licitação real: usar a régua da IA deixava o edital listado
 * como anexo do termo de referência, o que lê como erro.
 *
 * Sem documento do tipo "Edital", cai no primeiro da lista — que aí é mesmo o
 * mais relevante que existe.
 */
function escolherEdital(arquivos: readonly ArquivoConferido[]): number {
  const indice = arquivos.findIndex((arquivo) => /edital/i.test(arquivo.documentType));
  return indice >= 0 ? indice : 0;
}

/**
 * O documento do edital vira a versão; todo o resto entra como anexo dela, na
 * ordem de relevância em que o portal foi lido.
 */
export function montarRascunho(
  fila: DadosDaFila,
  identificador: PncpIdentifier,
  arquivos: readonly ArquivoConferido[],
  recebidoEm: Date,
): RascunhoDeLicitacao {
  if (arquivos.length === 0) throw new Error("Sem arquivo publicado no PNCP: não há versão de edital para registrar.");
  const escolhido = escolherEdital(arquivos);
  const principal = arquivos[escolhido]!;
  const anexos = arquivos.filter((_, indice) => indice !== escolhido);

  return {
    tender: {
      code: codigoDaLicitacao(identificador),
      // O número do processo é o que a equipe usa para falar da licitação; sem
      // ele, o identificador do portal é melhor do que um campo vazio.
      number: (fila.processNumber ?? fila.externalId).slice(0, 100),
      modality: fila.modality.slice(0, 100),
      subject: fila.subject,
      origin: (fila.noticeUrl ?? `PNCP ${fila.externalId}`).slice(0, 500),
      opportunityId: fila.opportunityId,
      ...(fila.contractingAuthorityId ? { contractingAuthorityId: fila.contractingAuthorityId } : {}),
      lots: [],
    },
    version: {
      fileName: principal.fileName.slice(0, 255),
      fileHash: principal.fileHash,
      uri: principal.uri,
      mimeType: principal.mimeType.slice(0, 160),
      sizeBytes: principal.sizeBytes,
      source: `PNCP — ${principal.titulo}`.slice(0, 500),
      receivedAt: recebidoEm,
      attachments: anexos.map((anexo) => ({
        fileName: anexo.fileName.slice(0, 255),
        fileHash: anexo.fileHash,
        source: `PNCP — ${anexo.titulo}`.slice(0, 500),
      })),
    },
  };
}
