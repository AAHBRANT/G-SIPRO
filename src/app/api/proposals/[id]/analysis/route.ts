import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/core/authorization/authorization-context";
import { getDatabase } from "@/core/database/prisma";
import { toApiError } from "@/core/errors/api-error";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authorization = await requirePermission("proposals.read");
    const id = z.uuid().parse((await params).id);
    const database = getDatabase();
    const proposal = await database.proposal.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!proposal) return NextResponse.json({ error: { message: "Proposta não encontrada." } }, { status: 404 });

    const documents = await database.managedDocument.findMany({
      where: { links: { some: { entityType: "PROPOSAL", entityId: id, role: "SOURCE_DOCUMENT" } } },
      include: {
        versions: {
          orderBy: { version: "desc" },
          take: 1,
          include: {
            aiExtractionExecutions: {
              orderBy: { startedAt: "desc" },
              take: 1,
              include: { evidence: true },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const serializedDocuments = documents.map((document) => {
      const version = document.versions[0];
      const execution = version?.aiExtractionExecutions[0];
      return {
        id: document.id,
        type: document.type,
        title: document.title,
        versionId: version?.id,
        version: version?.version,
        fileHash: version?.fileHash,
        analysis: execution ? {
          id: execution.id,
          status: execution.status,
          output: execution.output,
          confidence: execution.confidence?.toString() ?? null,
          limitations: execution.limitations,
          errorMessage: execution.errorMessage,
          evidence: execution.evidence.map((item) => ({ excerpt: item.excerpt, locator: item.locator })),
        } : null,
      };
    });

    const stopWords = new Set(["para", "como", "com", "sem", "uma", "das", "dos", "pela", "pelo", "deve", "devera", "exigida", "exigido", "tecnica", "tecnico", "capacidade", "atestado", "experiencia", "servicos", "servico", "execucao", "comprovacao"]);
    const requirementTexts = serializedDocuments.flatMap((document) => {
      const output = document.analysis?.output;
      if (!Array.isArray(output)) return [];
      return output.flatMap((entry) => entry && typeof entry === "object" && "field" in entry && "value" in entry && typeof entry.field === "string" && typeof entry.value === "string" && /capacidade|experi[eê]ncia|atestado|servi[cç]o/i.test(entry.field) ? [entry.value] : []);
    });
    const keywords = [...new Set(requirementTexts.flatMap((text) => text.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9]+/).filter((word) => word.length >= 4 && !stopWords.has(word))))].slice(0, 12);
    let archiveMatches: Array<Record<string, unknown>> = [];
    if (authorization.permissions.has("technical-archive.search") && keywords.length > 0) {
      const services = await database.executedService.findMany({
        where: {
          contract: { status: "VALIDATED" },
          OR: keywords.flatMap((keyword) => [
            { discipline: { contains: keyword, mode: "insensitive" as const } },
            { originalDescription: { contains: keyword, mode: "insensitive" as const } },
            { characteristics: { contains: keyword, mode: "insensitive" as const } },
          ]),
        },
        include: {
          quantities: { orderBy: [{ unit: "asc" }, { value: "desc" }] },
          contract: { include: { evidenceDocumentVersion: { include: { document: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      archiveMatches = services.map((service) => {
        const searchable = `${service.discipline} ${service.originalDescription} ${service.characteristics}`.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const matchedKeywords = keywords.filter((keyword) => searchable.includes(keyword));
        return {
          serviceId: service.id,
          discipline: service.discipline,
          description: service.originalDescription,
          characteristics: service.characteristics,
          quantities: service.quantities.map((quantity) => ({ value: quantity.value.toString(), unit: quantity.unit, source: quantity.source })),
          contract: { code: service.contract.code, subject: service.contract.subject, contractorName: service.contract.contractorName },
          evidence: { title: service.contract.evidenceDocumentVersion.document.title, versionId: service.contract.evidenceDocumentVersion.id, version: service.contract.evidenceDocumentVersion.version, fileHash: service.contract.evidenceDocumentVersion.fileHash },
          matchedKeywords,
          score: matchedKeywords.length,
        };
      }).sort((left, right) => Number(right.score) - Number(left.score)).slice(0, 8);
      await database.auditEvent.create({ data: { id: randomUUID(), actorType: "USER", actorId: authorization.actorId, action: "PROPOSAL_ARCHIVE_MATCHES_VIEWED", entityType: "PROPOSAL", entityId: id, correlationId: randomUUID(), outcome: "SUCCESS", origin: "proposal-analysis", metadata: { keywordCount: keywords.length, results: archiveMatches.length, rawTermsStored: false, automaticDecision: false } } });
    }
    return NextResponse.json({ data: { documents: serializedDocuments, archiveMatches } });
  } catch (error) {
    return toApiError(error);
  }
}
import { randomUUID } from "node:crypto";
