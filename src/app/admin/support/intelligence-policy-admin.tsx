"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type PolicyView = Readonly<{
  id: string;
  code: string;
  name: string;
  version: number;
  purpose: string;
  weights: { commercial: number; technical: number; studies: number };
  thresholds: { recommendedMinimum: number; restrictionsMinimum: number; minimumConfidence: number };
  coverageMinimum: number;
  effectiveFrom: string;
  changeReason: string;
  createdBy: string;
  createdById: string;
  createdAt: string;
  approvedAt: string | null;
  approvedBy: string | null;
  approvalNote: string | null;
}>;

async function post(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json() as { error?: { message?: string } };
  if (!response.ok) throw new Error(result.error?.message ?? "Operação não concluída.");
}

function number(form: FormData, name: string) {
  return Number(form.get(name));
}

function PolicyProposalForm({ effectiveFrom }: { effectiveFrom: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setSubmitting(true);
    setMessage("");
    try {
      await post("/api/intelligence-policies", {
        code: "OPPORTUNITY_INTELLIGENCE",
        name: "Modo Analítico Inteligente",
        purpose: "Apoiar a decisão de participação em oportunidades, distinguindo avaliação comercial, capacidade operacional e estudos de praticabilidade.",
        dimensions: [
          { perspective: "COMMERCIAL", code: "ATTRACTIVENESS", name: "Atratividade comercial", critical: false },
          { perspective: "TECHNICAL", code: "OPERATIONAL_CAPACITY", name: "Capacidade operacional", critical: true },
          { perspective: "STUDIES", code: "PRACTICABILITY", name: "Estudos e praticabilidade", critical: false },
        ],
        weights: {
          commercial: number(data, "commercial"),
          technical: number(data, "technical"),
          studies: number(data, "studies"),
        },
        thresholds: {
          recommendedMinimum: number(data, "recommendedMinimum"),
          restrictionsMinimum: number(data, "restrictionsMinimum"),
          minimumConfidence: number(data, "minimumConfidence"),
        },
        impedimentRules: [
          {
            type: "HIGH_INDEBTEDNESS_RISK",
            enabled: true,
            description: "Reprovação pelos índices exigidos no edital ou avaliação formal da área financeira.",
          },
          {
            type: "NON_PAYING_CUSTOMER",
            enabled: true,
            description: "Classificação formal da área financeira, baseada em histórico e evidências.",
          },
        ],
        authorizedSources: [
          "opportunities",
          "proposals",
          "tender_documents",
          "technical_archive",
          "compliance_matrix",
          "internal_financial_assessments",
          "operational_bases",
          "approved_climate_provider",
          "google_routes",
        ],
        coverageMinimum: 70,
        effectiveFrom: data.get("effectiveFrom"),
        changeReason: data.get("changeReason"),
      });
      form.reset();
      setMessage("Política registrada. Agora um proprietário diferente do autor deve aprová-la.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível registrar a política.");
    } finally {
      setSubmitting(false);
    }
  }

  return <form className="rounded-2xl border border-border bg-white p-5 shadow-sm" onSubmit={submit}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-xs font-black uppercase tracking-wider text-brand">Proposta inicial</p>
        <h3 className="mt-1 text-lg font-black">Política do Modo Analítico</h3>
        <p className="mt-1 text-sm text-muted">Um usuário mestre registra; um proprietário diferente do autor aprova.</p>
      </div>
      <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">Não entra em vigor sem aprovação</span>
    </div>
    <div className="mt-5 grid gap-4 md:grid-cols-3">
      <label className="grid gap-1 text-xs font-bold">Peso comercial (%)
        <input className="rounded-lg border border-border px-3 py-2 text-sm" defaultValue="35" max="98" min="1" name="commercial" required type="number"/>
      </label>
      <label className="grid gap-1 text-xs font-bold">Peso técnico (%)
        <input className="rounded-lg border border-border px-3 py-2 text-sm" defaultValue="40" max="98" min="1" name="technical" required type="number"/>
      </label>
      <label className="grid gap-1 text-xs font-bold">Peso de estudos (%)
        <input className="rounded-lg border border-border px-3 py-2 text-sm" defaultValue="25" max="98" min="1" name="studies" required type="number"/>
      </label>
      <label className="grid gap-1 text-xs font-bold">Recomendado a partir de
        <input className="rounded-lg border border-border px-3 py-2 text-sm" defaultValue="80" max="100" min="1" name="recommendedMinimum" required type="number"/>
      </label>
      <label className="grid gap-1 text-xs font-bold">Com ressalvas a partir de
        <input className="rounded-lg border border-border px-3 py-2 text-sm" defaultValue="60" max="99" min="0" name="restrictionsMinimum" required type="number"/>
      </label>
      <label className="grid gap-1 text-xs font-bold">Confiança mínima (%)
        <input className="rounded-lg border border-border px-3 py-2 text-sm" defaultValue="70" max="100" min="0" name="minimumConfidence" required type="number"/>
      </label>
      <label className="grid gap-1 text-xs font-bold">Vigência
        <input className="rounded-lg border border-border px-3 py-2 text-sm" defaultValue={effectiveFrom} name="effectiveFrom" required type="date"/>
      </label>
      <label className="grid gap-1 text-xs font-bold md:col-span-2">Justificativa
        <input className="rounded-lg border border-border px-3 py-2 text-sm" defaultValue="Política inicial para homologação controlada do Modo Analítico Inteligente." maxLength={1000} minLength={10} name="changeReason" required/>
      </label>
    </div>
    <div className="mt-4 rounded-xl bg-slate-50 p-4 text-xs text-slate-700">
      <strong>Regras fixas:</strong> cobertura mínima de 70%; capacidade operacional crítica; alto risco de endividamento e cliente formalmente classificado como não pagador exigem decisão do proprietário.
    </div>
    <button className="mt-4 rounded-lg bg-brand px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50" disabled={submitting} type="submit">
      {submitting ? "Registrando..." : "Registrar para aprovação"}
    </button>
    {message && <p className="mt-3 text-sm font-semibold" role="status">{message}</p>}
  </form>;
}

function PolicyApprovalForm({ policyId }: { policyId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setSubmitting(true);
    setMessage("");
    try {
      await post(`/api/intelligence-policies/${policyId}/approve`, { note: data.get("note") });
      setMessage("Política aprovada e vigente.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "A aprovação não foi concluída.");
    } finally {
      setSubmitting(false);
    }
  }

  return <form className="mt-3 flex flex-wrap gap-2" onSubmit={submit}>
    <input className="min-w-64 flex-1 rounded-lg border border-border px-3 py-2 text-xs" defaultValue="Pesos, limites, fontes e impedimentos aprovados para homologação controlada." maxLength={1000} minLength={10} name="note" required/>
    <button className="rounded-lg bg-brand px-4 py-2 text-xs font-bold text-white disabled:opacity-50" disabled={submitting} type="submit">
      {submitting ? "Aprovando..." : "Aprovar política"}
    </button>
    {message && <p className="w-full text-xs font-semibold" role="status">{message}</p>}
  </form>;
}

export function IntelligencePolicyAdmin({
  canApprove,
  canPropose,
  currentActorId,
  effectiveFrom,
  policies,
}: {
  canApprove: boolean;
  canPropose: boolean;
  currentActorId: string;
  effectiveFrom: string;
  policies: readonly PolicyView[];
}) {
  return <section className="mt-6 scroll-mt-6" id="intelligence-policies">
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-xs font-black uppercase tracking-wider text-brand">Governança analítica</p>
        <h2 className="mt-1 text-xl font-black">Políticas do Modo Analítico</h2>
        <p className="mt-1 text-sm text-muted">Pesos e limites só entram em vigor depois da aprovação do proprietário.</p>
      </div>
    </div>
    {canPropose && <PolicyProposalForm effectiveFrom={effectiveFrom}/>}
    <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-600">
            <tr><th className="px-4 py-3">Política</th><th className="px-4 py-3">Pesos</th><th className="px-4 py-3">Faixas</th><th className="px-4 py-3">Autor / data</th><th className="px-4 py-3">Situação</th><th className="px-4 py-3">Ação</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {policies.length === 0 && <tr><td className="px-4 py-6 text-center text-muted" colSpan={6}>Nenhuma política registrada.</td></tr>}
            {policies.map(policy => {
              const ownPolicy = policy.createdById === currentActorId;
              return <tr key={policy.id}>
                <td className="px-4 py-3"><strong>{policy.name} · v{policy.version}</strong><p className="mt-1 text-muted">{policy.changeReason}</p></td>
                <td className="whitespace-nowrap px-4 py-3">C {policy.weights.commercial}% · T {policy.weights.technical}% · E {policy.weights.studies}%</td>
                <td className="whitespace-nowrap px-4 py-3">≥ {policy.thresholds.recommendedMinimum} recomendado<br/>≥ {policy.thresholds.restrictionsMinimum} ressalvas</td>
                <td className="px-4 py-3">{policy.createdBy}<br/><span className="text-muted">{new Date(policy.createdAt).toLocaleString("pt-BR")}</span></td>
                <td className="px-4 py-3">{policy.approvedAt
                  ? <span className="rounded-full bg-emerald-50 px-2 py-1 font-bold text-emerald-700">Aprovada</span>
                  : <span className="rounded-full bg-amber-50 px-2 py-1 font-bold text-amber-800">Aguardando proprietário</span>}
                </td>
                <td className="min-w-80 px-4 py-3">
                  {policy.approvedAt
                    ? <p><strong>{policy.approvedBy}</strong><br/><span className="text-muted">{policy.approvalNote}</span></p>
                    : canApprove && !ownPolicy
                      ? <PolicyApprovalForm policyId={policy.id}/>
                      : <p className="text-muted">{ownPolicy ? "O autor não pode aprovar a própria política." : "Aprovação exclusiva do proprietário."}</p>}
                </td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    </div>
  </section>;
}
