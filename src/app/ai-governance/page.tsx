import Link from "next/link";

import { requireMaster } from "@/core/authorization/authorization-context";
import { authorize } from "@/core/authorization/policy";
import { getDatabase } from "@/core/database/prisma";

import { AiApprovalForm, AiModelForm, AiUseCaseForm } from "./ai-governance-forms";

export default async function AiGovernancePage() {
  const authorization = await requireMaster();
  const database = getDatabase();
  const canManage = authorize(authorization, { permission: "ai.manage" }).allowed;
  const canApprove = authorize(authorization, { permission: "ai.approve" }).allowed;
  const [models, useCases, users] = await Promise.all([
    database.aiModelVersion.findMany({ orderBy: [{ provider: "asc" }, { modelName: "asc" }, { version: "asc" }] }),
    database.aiUseCaseDefinition.findMany({ include: { modelVersion: true, approval: true }, orderBy: [{ code: "asc" }, { version: "asc" }] }),
    database.user.findMany({ where: { status: "ACTIVE" }, orderBy: { displayName: "asc" } }),
  ]);
  const latestModels = models.filter(item => !models.some(candidate => candidate.modelKey === item.modelKey && candidate.version > item.version));
  const latestUseCases = useCases.filter(item => !useCases.some(candidate => candidate.useCaseKey === item.useCaseKey && candidate.version > item.version));
  const names = new Map(users.map(user => [user.id, user.displayName]));

  return <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10">
    <header>
      <Link className="text-sm font-bold text-brand" href="/admin">← Administrador</Link>
      <p className="mt-6 text-sm font-bold uppercase tracking-wider text-brand">Configuração administrativa</p>
      <h1 className="mt-1 text-3xl font-bold">Governança de Inteligência Artificial</h1>
      <p className="mt-2 text-muted">Configuração restrita aos administradores. A equipe operacional apenas importa os documentos e recebe o reconhecimento autorizado.</p>
    </header>
    {canManage && <>
      <AiModelForm models={latestModels.map(item => ({ id: item.id, label: `${item.provider} · ${item.modelName} · inventário v${item.version}` }))}/>
      <AiUseCaseForm
        models={latestModels.filter(item => item.status === "ACTIVE").map(item => ({ id: item.id, label: `${item.provider} · ${item.modelName} · ${item.providerModelVersion}` }))}
        useCases={latestUseCases.map(item => ({ id: item.id, label: `${item.code} · v${item.version}` }))}
        users={users.map(user => ({ id: user.id, label: user.displayName }))}
      />
    </>}
    <section className="grid gap-4">
      {useCases.map(item => {
        const inputs = item.inputs as string[];
        const outputs = item.outputs as string[];
        const audience = item.audience as string[];
        const limitations = item.limitations as string[];
        const sources = item.authorizedSources as Array<{ documentType: string; requiredPermission: string }>;
        const criteria = item.evaluationCriteria as string[];
        const latest = latestUseCases.some(candidate => candidate.id === item.id);
        return <article className="rounded-2xl border border-border bg-surface p-6" key={item.id}>
          <div className="flex justify-between gap-3">
            <div><p className="text-xs font-bold text-brand">{item.code} · versão {item.version}</p><h2 className="text-xl font-bold">{item.name}</h2></div>
            <strong className="text-xs">{item.approval ? "APROVADO" : "RASCUNHO"}</strong>
          </div>
          <p className="mt-3 text-sm">{item.purpose}</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl bg-background p-3 text-xs"><b>Entradas:</b> {inputs.join(" · ")}<br/><b>Saídas:</b> {outputs.join(" · ")}<br/><b>Público:</b> {audience.join(" · ")}</div>
            <div className="rounded-xl bg-background p-3 text-xs"><b>Modelo:</b> {item.modelVersion.provider} · {item.modelVersion.modelName} · {item.modelVersion.providerModelVersion}<br/><b>Proprietário:</b> {names.get(item.ownerId) ?? item.ownerId}<br/><b>Região:</b> {item.modelVersion.dataProcessingRegion}<br/><b>Retenção:</b> {item.modelVersion.retentionRule}</div>
            <div className="rounded-xl bg-background p-3 text-xs"><b>Riscos:</b> {item.riskAssessment}<br/><b>Limites:</b> {limitations.join(" · ")}</div>
            <div className="rounded-xl bg-background p-3 text-xs"><b>Fontes:</b> {sources.map(source => `${source.documentType} (${source.requiredPermission})`).join(" · ")}<br/><b>Avaliação:</b> {criteria.join(" · ")}</div>
          </div>
          <p className="mt-3 break-all font-mono text-[10px] text-muted">Prompt SHA-256 {item.promptHash}</p>
          {item.approval
            ? <p className="mt-2 text-xs font-bold">Aprovado em {item.approval.approvedAt.toLocaleString("pt-BR")} · {item.approval.note}</p>
            : canApprove && latest && <AiApprovalForm id={item.id}/>
          }
        </article>;
      })}
    </section>
  </main>;
}
