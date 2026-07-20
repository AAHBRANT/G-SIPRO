import { notFound } from "next/navigation";
import { getCurrentAuthorizationContext } from "@/core/authorization/authorization-context";
import { authorize } from "@/core/authorization/policy";
import { getDatabase } from "@/core/database/prisma";
import { ArchiveWorkspace, type ArchiveItem } from "./archive-workspace";
import { fieldsFromExtractionOutput, servicesFromExtraction } from "./extraction-view-model";

type AuthorizedSource = { documentType?: string };

export default async function TechnicalArchivePage() {
  const authorization = await getCurrentAuthorizationContext();
  if (!authorize(authorization, { permission: "technical-archive.read" }).allowed) notFound();
  const database = getDatabase();
  const [documents, users, useCases] = await Promise.all([
    database.managedDocument.findMany({
      where: { type: "ATESTADO" }, include: { owner: true, versions: { orderBy: { version: "desc" }, include: { technicalEvidenceRecords: { include: { experience: { include: { services: { include: { quantities: true } } } } } }, aiExtractionExecutions: { orderBy: { startedAt: "desc" }, take: 1 } } } }, orderBy: { createdAt: "desc" },
    }),
    database.user.findMany({ where: { status: "ACTIVE" }, select: { id: true, displayName: true }, orderBy: { displayName: "asc" } }),
    database.aiUseCaseDefinition.findMany({ where: { approval: { isNot: null }, modelVersion: { status: "ACTIVE" }, nextVersions: { none: {} } }, select: { id: true, authorizedSources: true }, orderBy: { version: "desc" } }),
  ]);
  const extractionDefinition = useCases.find(item => Array.isArray(item.authorizedSources) && (item.authorizedSources as AuthorizedSource[]).some(source => source.documentType === "ATESTADO"));
  const items: ArchiveItem[] = documents.flatMap(document => document.versions.slice(0, 1).map(version => {
    const evidence = version.technicalEvidenceRecords[0];
    const execution = version.aiExtractionExecutions[0];
    const extractedFields = fieldsFromExtractionOutput(execution?.output);
    const baseFields = evidence ? [
      { field: "Número", value: evidence.number }, { field: "Emissor", value: evidence.issuingBody }, { field: "Objeto / atividade", value: evidence.subjectActivity },
      { field: "Contratante", value: evidence.experience.contractorName }, { field: "Período", value: `${evidence.experience.startedAt.toLocaleDateString("pt-BR")} a ${evidence.experience.endedAt.toLocaleDateString("pt-BR")}` },
    ] : [];
    const evidenceServices = evidence?.experience.services.map(service => ({ discipline: service.discipline, description: service.originalDescription, quantities: service.quantities.map(quantity => `${quantity.value.toString()} ${quantity.unit}`).join("; ") })) ?? [];
    const services = evidenceServices.length ? evidenceServices : servicesFromExtraction(extractedFields);
    const fieldValue = (pattern: RegExp) => [...baseFields, ...extractedFields].find(field => pattern.test(field.field))?.value;
    return { id: document.id, versionId: version.id, title: document.title, owner: document.owner.displayName, version: version.version, mimeType: version.mimeType, size: `${(Number(version.sizeBytes) / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`, hash: version.fileHash, origin: version.origin, createdAt: version.createdAt.toLocaleDateString("pt-BR"), number: evidence?.number ?? fieldValue(/número|numero/i), issuer: evidence?.issuingBody ?? fieldValue(/emissor|conselho/i), subject: evidence?.subjectActivity ?? fieldValue(/objeto|atividade/i), contractor: evidence?.experience.contractorName ?? fieldValue(/contratante|cliente/i), services, fields: [...baseFields, ...extractedFields], extractionStatus: execution?.status, extractionError: execution?.errorMessage ?? undefined };
  }));

  return <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8"><ArchiveWorkspace canCreate={authorize(authorization, { permission: "documents.create" }).allowed} extractionDefinitionId={authorize(authorization, { permission: "ai.execute" }).allowed ? extractionDefinition?.id : undefined} items={items} users={users.map(user => ({ id: user.id, name: user.displayName }))}/></div>;
}
