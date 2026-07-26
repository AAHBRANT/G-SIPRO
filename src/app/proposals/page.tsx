import { notFound } from "next/navigation";
import { getCurrentAuthorizationContext } from "@/core/authorization/authorization-context";
import { authorize } from "@/core/authorization/policy";
import { getDatabase } from "@/core/database/prisma";
import { ProposalPanel } from "./proposal-panel";
import type { ProposalDocumentType, ProposalExtractionDefinitions } from "./create-proposal-form";

const originLabels: Record<string, string> = {
  PUBLIC_TENDER: "Edital / concorrência pública",
  PRIVATE_COMPETITION: "Concorrência privada",
  DIRECT: "Proposta direta",
};

export default async function ProposalsPage({ searchParams }: { searchParams: Promise<{ new?: string; code?: string }> }) {
  const params = await searchParams;
  const authorization = await getCurrentAuthorizationContext();

  if (!authorize(authorization, { permission: "proposals.read" }).allowed) {
    notFound();
  }

  const database = getDatabase();
  const [panelRecords, opportunities, users, useCases] = await Promise.all([
    database.proposal.findMany({
      where: { deletedAt: null },
      include: {
        opportunity: {
          include: {
            customer: true,
            contractingAuthority: true,
            owner: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    database.opportunity.findMany({
      include: {
        tenders: {
          include: {
            versions: { orderBy: { version: "desc" } },
            lots: { orderBy: { code: "asc" } },
          },
          orderBy: { code: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    database.user.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, displayName: true },
      orderBy: { displayName: "asc" },
    }),
    database.aiUseCaseDefinition.findMany({
      where: {
        approval: { isNot: null },
        modelVersion: { status: "ACTIVE" },
        nextVersions: { none: {} },
      },
      select: { id: true, code: true, authorizedSources: true },
      orderBy: { version: "desc" },
    }),
  ]);

  const options = opportunities.map((opportunity) => ({
    id: opportunity.id,
    label: `${opportunity.code} · ${opportunity.subject ?? "Sem objeto"}`,
    tenders: opportunity.tenders.map((tender) => ({
      id: tender.id,
      label: `${tender.code} · ${tender.number}`,
      versions: tender.versions.map((version) => ({
        id: version.id,
        label: `v${version.version} · ${version.fileName} · SHA ${version.fileHash.slice(0, 12)}…`,
      })),
      lots: tender.lots.map((lot) => ({
        id: lot.id,
        label: `${lot.code} · ${lot.subject}`,
      })),
    })),
  }));

  const canCreate = false;
  const documentTypes: ProposalDocumentType[] = ["EDITAL", "TERMO_REFERENCIA", "ESTUDO_TECNICO_PRELIMINAR", "ANEXO_EDITAL", "OUTRO"];
  const extractionDefinitions: ProposalExtractionDefinitions = {};
  if (authorize(authorization, { permission: "ai.execute" }).allowed) {
    for (const type of documentTypes) {
      const permittedForType = (item: (typeof useCases)[number]) => Array.isArray(item.authorizedSources) && (item.authorizedSources as Array<{ documentType?: string; requiredPermission?: string }>).some((source) => source.documentType === type && typeof source.requiredPermission === "string" && authorize(authorization, { permission: source.requiredPermission }).allowed);
      const useCase = useCases.find((item) => item.code === "GSIPRO_ANALISE_EDITAL_TR_ETP" && permittedForType(item)) ?? useCases.find(permittedForType);
      if (useCase) extractionDefinitions[type] = useCase.id;
    }
  }
  const panelItems = panelRecords.map((item) => ({
    id: item.id,
    code: item.code,
    description: item.title,
    type: originLabels[item.originType] ?? item.originType,
    client:
      item.opportunity.customer?.name ??
      item.opportunity.contractingAuthority?.name ??
      "Não informado",
    deliveryAt: item.opportunity.deliveryAt?.toISOString() ?? null,
    status: item.status,
    responsible: item.opportunity.owner?.displayName ?? "Não atribuído",
    createdAt: item.createdAt.toISOString(),
  }));

  return (
    <main className="mx-auto flex w-full max-w-[1500px] flex-1 flex-col gap-5 px-4 py-6 sm:px-5">
      <ProposalPanel
        items={panelItems}
        initialCreateOpen={params.new === "1"}
        initialQuery={params.code ?? ""}
        opportunities={options}
        users={users.map((user) => ({ id: user.id, label: user.displayName }))}
        extractionDefinitions={extractionDefinitions}
        canCreate={canCreate}
        canUploadDocuments={authorize(authorization, { permission: "documents.create" }).allowed && authorize(authorization, { permission: "documents.link" }).allowed}
        canManageStatus={authorize(authorization, { permission: "proposals.manage-status" }).allowed}
        canDelete={authorize(authorization, { permission: "proposals.delete" }).allowed}
      />

    </main>
  );
}
