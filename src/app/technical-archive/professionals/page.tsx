import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentAuthorizationContext } from "@/core/authorization/authorization-context";
import { authorize } from "@/core/authorization/policy";
import { getDatabase } from "@/core/database/prisma";
import { ProfessionalService } from "@/modules/technical-archive/application/professional-service";
import { PrismaProfessionalRepository } from "@/modules/technical-archive/infrastructure/prisma-professional-repository";
import { ProfessionalForm } from "./professional-form";

export default async function ProfessionalsPage() {
  const authorization = await getCurrentAuthorizationContext();
  if (!authorization || !authorize(authorization, { permission: "technical-professionals.read" }).allowed) notFound();
  const [professionals, contracts, works, evidence, documentVersions] = await Promise.all([
    new ProfessionalService(new PrismaProfessionalRepository()).list(authorization.actorId),
    getDatabase().executedContract.findMany({ orderBy: { code: "asc" } }),
    getDatabase().executedWork.findMany({ include: { contract: true }, orderBy: { name: "asc" } }),
    getDatabase().technicalEvidence.findMany({ where: { type: { in: ["CAT", "ART"] } }, include: { experience: true }, orderBy: [{ type: "asc" }, { number: "asc" }, { version: "desc" }] }),
    getDatabase().managedDocumentVersion.findMany({ include: { document: true }, orderBy: [{ createdAt: "desc" }, { version: "desc" }] }),
  ]);
  const targets = [
    ...contracts.map(item => ({ id: item.id, targetType: "CONTRACT" as const, label: `Contrato ${item.code} · ${item.subject}` })),
    ...works.map(item => ({ id: item.id, targetType: "WORK" as const, label: `Obra ${item.name} · contrato ${item.contract.code}` })),
    ...evidence.map(item => ({ id: item.id, targetType: "TECHNICAL_EVIDENCE" as const, documentVersionId: item.documentVersionId, label: `${item.type} ${item.number} v${item.version} · ${item.experience.code}` })),
  ];
  return <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10">
    <div><Link className="text-sm font-bold text-brand" href="/technical-archive">← Acervo técnico</Link><h1 className="mt-6 text-3xl font-bold">Profissionais e vínculos protegidos</h1><p className="mt-2 text-muted">Dados pessoais minimizados, tratados por finalidade e acessíveis somente mediante permissão específica.</p></div>
    {authorize(authorization, { permission: "technical-professionals.create" }).allowed && targets.length > 0 && documentVersions.length > 0 && <ProfessionalForm targets={targets} documents={documentVersions.map(item => ({ id: item.id, label: `${item.document.title} · versão ${item.version} · ${item.fileHash.slice(0, 12)}…` }))} />}
    <section className="grid gap-4">{professionals.map(professional => <article className="rounded-2xl border border-border bg-surface p-5" key={professional.id}><div className="flex flex-wrap justify-between gap-2"><div><p className="text-xs font-bold text-brand">{professional.council} · {professional.registrationNumber}</p><h2 className="mt-1 text-xl font-bold">{professional.fullName}</h2><p className="text-sm text-muted">{professional.professionalTitle}</p></div><span className="text-sm text-muted">{professional.status} · {professional.classification}</span></div><div className="mt-3 rounded-xl border border-border p-3 text-sm"><p><strong>Finalidade:</strong> {professional.processingPurpose}</p><p className="mt-1"><strong>Base legal:</strong> {professional.legalBasis}</p></div><div className="mt-3 grid gap-2">{professional.links.map(link => <div className="rounded-xl bg-background p-3 text-sm" key={link.id}><strong>{link.role} · {link.targetLabel}</strong><p className="text-muted">{link.startedAt.toLocaleDateString("pt-BR")} a {link.endedAt.toLocaleDateString("pt-BR")} · {link.responsibility}</p><p className="text-muted">Fonte: {link.source} · {link.documentLabel}</p></div>)}</div></article>)}{professionals.length === 0 && <p className="rounded-2xl border border-border bg-surface p-10 text-center text-muted">Nenhum profissional cadastrado.</p>}</section>
  </main>;
}
