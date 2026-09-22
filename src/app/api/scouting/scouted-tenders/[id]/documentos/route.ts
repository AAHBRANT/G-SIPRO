/**
 * Entrega, num zip só, TODOS os documentos que o órgão publicou para a
 * licitação — o conteúdo da aba "Arquivos" do PNCP.
 *
 * Nasceu de "a função de baixar o edital tá só baixando o termo de referência,
 * ele tem que baixar todos os documentos da licitação" (21/09/2026). Antes, o
 * link da tela apontava para `edital.source.uri`, o arquivo único que a IA leu
 * — escolhido por `edital-relevance` pelas parcelas com quantitativo, que quase
 * nunca é o "EDITAL.pdf". Aquela escolha continua certa para decidir o que ler;
 * ela só nunca deveria ter virado o botão de download.
 *
 * ⚠️ Somente leitura, como todo o módulo: busca no PNCP e devolve. Não grava
 * arquivo nenhum no G-SIPRO, nem no acervo documental — é a mesma regra que a
 * leitura de edital respeita, e `provar-leitura-edital.mts` vigia.
 *
 * O zip vai sem compressão (nível 0) de propósito: PDF e imagem já vêm
 * comprimidos, e espremer de novo gastaria CPU do contêiner para economizar
 * quase nada.
 *
 * ⚠️ Quando o órgão publica UM arquivo só, ele sai como está, sem embrulho.
 * É o caso comum de quem sobe tudo num .zip ou .rar próprio — medido em
 * 21/09/2026 numa licitação real, onde os "8 arquivos" eram na verdade um
 * único `199051_editais_...zip`. Embrulhar aquilo num segundo zip daria ao
 * usuário duas camadas para abrir e nenhum ganho.
 */
import { zipSync } from "fflate";
import { NextResponse } from "next/server";

import { requirePermission } from "@/core/authorization/authorization-context";
import { getDatabase } from "@/core/database/prisma";
import { toApiError } from "@/core/errors/api-error";
import { ResourceNotFoundError, ValidationError } from "@/core/errors/application-error";
import { createLogger } from "@/core/observability/logger";
import { getEnvironment } from "@/core/config/env";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { montarPacote } from "@/modules/scouting/domain/pacote-de-documentos";
import { parsePncpIdentifier } from "@/modules/scouting/domain/pncp-identifier";
import { PncpFilesClient } from "@/modules/scouting/infrastructure/pncp-files-client";

/** Nome de arquivo que o Windows aceita: sem os caracteres que ele recusa. */
const sanitizar = (texto: string) => texto.replace(/[\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim();

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    const logger = createLogger(getEnvironment());
    try {
      await requirePermission("opportunities.read");
      const { id } = await params;

      const licitacao = await getDatabase().scoutedTender.findUnique({
        where: { id },
        select: { externalId: true, processNumber: true, authorityName: true },
      });
      if (!licitacao) return toApiError(new ResourceNotFoundError("Licitação não encontrada na fila."));

      const identificador = parsePncpIdentifier(licitacao.externalId);
      if (!identificador) {
        return toApiError(new ValidationError(
          `Não dá para montar o pacote: o identificador "${licitacao.externalId}" não segue o padrão do PNCP.`,
        ));
      }

      const cliente = new PncpFilesClient();
      const arquivos = await cliente.list(identificador.authorityDocument, identificador.year, identificador.sequence);
      if (arquivos.length === 0) {
        return toApiError(new ResourceNotFoundError("O órgão não publicou nenhum arquivo para esta licitação no PNCP."));
      }

      const unico = arquivos.length === 1 ? await cliente.download(arquivos[0]!) : null;
      if (unico) {
        logger.info({ scoutedTenderId: id, publicados: 1, bytes: unico.bytes.byteLength, correlationId: context.correlationId },
          "Documento único da licitação entregue sem empacotar.");
        return new NextResponse(new Uint8Array(unico.bytes), {
          headers: {
            "Content-Type": unico.mimeType,
            "Content-Disposition": `attachment; filename="${sanitizar(unico.filename)}"`,
            "Content-Length": String(unico.bytes.byteLength),
            "Cache-Control": "no-store",
            // A tela precisa poder dizer QUANTOS documentos o órgão publicou.
            // Sem isso, receber um arquivo só parece defeito do G-SIPRO quando
            // é o portal que não tem mais nada — foi a dúvida real de
            // 22/09/2026 ("ta baixando só o edital").
            "x-documentos-publicados": "1",
            "x-documentos-incluidos": "1",
            "x-correlation-id": context.correlationId,
          },
        });
      }
      if (arquivos.length === 1) {
        return toApiError(new ResourceNotFoundError(
          `O único arquivo publicado ("${arquivos[0]!.title}") passa do limite de tamanho. Abra a licitação no PNCP para baixá-lo na origem.`,
        ));
      }

      const pacote = await montarPacote(
        arquivos,
        (arquivo) => cliente.download(arquivo),
        (arquivo) => arquivo.title,
      );
      if (pacote.entradas.length === 0) {
        return toApiError(new ResourceNotFoundError(
          `Nenhum dos ${arquivos.length} arquivo(s) pôde ser baixado do PNCP agora. Abra a licitação no PNCP para pegá-los na origem.`,
        ));
      }

      const conteudo: Record<string, Uint8Array> = {};
      for (const entrada of pacote.entradas) conteudo[entrada.nome] = entrada.conteudo;
      // O que não coube precisa viajar junto: quem abrir o zip semanas depois
      // não tem como saber que faltou alguma coisa.
      if (pacote.ignorados.length > 0) {
        conteudo["_NAO-INCLUIDOS.txt"] = new TextEncoder().encode(
          ["Estes documentos existem no PNCP e não entraram neste pacote:", "", ...pacote.ignorados.map((i) => `- ${i}`), "",
            "Baixe-os direto na página da licitação no PNCP."].join("\n"),
        );
      }

      const zip = zipSync(conteudo, { level: 0 });
      const nome = sanitizar(`licitacao ${licitacao.processNumber ?? licitacao.externalId}`);

      logger.info({
        scoutedTenderId: id,
        publicados: arquivos.length,
        incluidos: pacote.entradas.length,
        ignorados: pacote.ignorados.length,
        bytes: pacote.bytesTotais,
        correlationId: context.correlationId,
      }, "Pacote de documentos da licitação entregue.");

      return new NextResponse(new Uint8Array(zip), {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${nome}.zip"`,
          "Content-Length": String(zip.byteLength),
          "Cache-Control": "no-store",
          "x-documentos-publicados": String(arquivos.length),
          "x-documentos-incluidos": String(pacote.entradas.length),
          "x-correlation-id": context.correlationId,
        },
      });
    } catch (error) {
      return toApiError(error);
    }
  });
}
