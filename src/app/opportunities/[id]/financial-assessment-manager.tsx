"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

export type FinancialSubject = Readonly<{
  type: "customer" | "authority";
  id: string;
  name: string;
}>;

type FinancialRecord = Readonly<{
  id: string;
  version: number;
  conclusion: "ADEQUATE" | "HIGH_RISK" | "INSUFFICIENT_DATA";
  periodStart: string;
  periodEnd: string;
  justification: string;
  confirmedAt: string;
}>;

type PaymentRecord = Readonly<{
  id: string;
  version: number;
  classification: "GOOD_PAYER" | "ATTENTION" | "NON_PAYER" | "INSUFFICIENT_DATA";
  periodStart: string;
  periodEnd: string;
  justification: string;
  confirmedAt: string;
}>;

type ApiResult<T> = { data?: T; error?: { message?: string } };

const fieldClass = "rounded-lg border border-slate-200 bg-white px-3 py-2 font-normal text-slate-800";
const today = () => new Date().toISOString().slice(0, 10);

function dateLabel(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function optionalNumber(form: FormData, name: string) {
  const value = form.get(name)?.toString().trim();
  return value ? Number(value) : undefined;
}

export function FinancialAssessmentManager({
  opportunityId,
  subject,
  canRead,
  canAssessFinancial,
  canAssessClientRisk,
}: {
  opportunityId: string;
  subject?: FinancialSubject;
  canRead: boolean;
  canAssessFinancial: boolean;
  canAssessClientRisk: boolean;
}) {
  const [financial, setFinancial] = useState<readonly FinancialRecord[]>([]);
  const [payment, setPayment] = useState<readonly PaymentRecord[]>([]);
  const [busy, setBusy] = useState<"financial" | "payment" | "loading" | null>("loading");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!canRead) return;
    setBusy("loading");
    const financialRequest = fetch(`/api/opportunities/${opportunityId}/financial-assessments`);
    const paymentRequest = subject
      ? fetch(`/api/payment-assessments?${subject.type === "customer" ? "customerId" : "authorityId"}=${subject.id}`)
      : Promise.resolve(null);
    const [financialResponse, paymentResponse] = await Promise.all([financialRequest, paymentRequest]);
    const financialResult = await financialResponse.json().catch(() => ({})) as ApiResult<FinancialRecord[]>;
    const paymentResult = paymentResponse
      ? await paymentResponse.json().catch(() => ({})) as ApiResult<PaymentRecord[]>
      : {};
    setFinancial(financialResponse.ok ? financialResult.data ?? [] : []);
    setPayment(paymentResponse?.ok ? paymentResult.data ?? [] : []);
    if (!financialResponse.ok || (paymentResponse && !paymentResponse.ok)) {
      setMessage(financialResult.error?.message ?? paymentResult.error?.message ?? "Não foi possível consultar as avaliações formais.");
    }
    setBusy(null);
  }, [canRead, opportunityId, subject]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function submitFinancial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const conclusion = form.get("conclusion")?.toString() as FinancialRecord["conclusion"];
    const hasIndex = conclusion !== "INSUFFICIENT_DATA";
    const payload = {
      periodStart: form.get("periodStart"),
      periodEnd: form.get("periodEnd"),
      indices: hasIndex ? [{
        code: form.get("indexCode"),
        name: form.get("indexName"),
        formulaDescription: form.get("formulaDescription"),
        comparison: form.get("comparison"),
        requiredLimit: Number(form.get("requiredLimit")),
        actualValue: Number(form.get("actualValue")),
        sourceReference: form.get("sourceReference"),
        sourceDate: form.get("sourceDate"),
      }] : [],
      conclusion,
      justification: form.get("justification"),
      evidence: [{
        sourceType: "ANÁLISE FINANCEIRA INTERNA",
        sourceReference: form.get("sourceReference"),
        sourceDate: form.get("sourceDate"),
      }],
      confirmedAt: new Date().toISOString(),
    };
    setBusy("financial");
    setMessage("Registrando avaliação financeira formal…");
    const response = await fetch(`/api/opportunities/${opportunityId}/financial-assessments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({})) as ApiResult<FinancialRecord>;
    setBusy(null);
    setMessage(response.ok ? "Avaliação financeira registrada. Agora consolide a análise." : result.error?.message ?? "Não foi possível registrar a avaliação.");
    if (response.ok) {
      formElement.reset();
      await load();
    }
  }

  async function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!subject) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const payload = {
      ...(subject.type === "customer" ? { customerId: subject.id } : { authorityId: subject.id }),
      periodStart: form.get("periodStart"),
      periodEnd: form.get("periodEnd"),
      classification: form.get("classification"),
      authorizedMetrics: {
        invoiceCount: optionalNumber(form, "invoiceCount"),
        overdueCount: optionalNumber(form, "overdueCount"),
        averageDelayDays: optionalNumber(form, "averageDelayDays"),
        overdueAmount: optionalNumber(form, "overdueAmount"),
        currency: form.get("currency")?.toString().trim() || undefined,
      },
      justification: form.get("justification"),
      evidence: [{
        sourceType: "HISTÓRICO FINANCEIRO AUTORIZADO",
        sourceReference: form.get("sourceReference"),
        sourceDate: form.get("sourceDate"),
      }],
      confirmedAt: new Date().toISOString(),
    };
    setBusy("payment");
    setMessage("Registrando desempenho formal de pagamento…");
    const response = await fetch("/api/payment-assessments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({})) as ApiResult<PaymentRecord>;
    setBusy(null);
    setMessage(response.ok ? "Desempenho de pagamento registrado. Agora consolide a análise." : result.error?.message ?? "Não foi possível registrar a avaliação.");
    if (response.ok) {
      formElement.reset();
      await load();
    }
  }

  if (!canRead) {
    return <p className="rounded-xl bg-slate-50 p-4 text-xs text-slate-500">As avaliações formais exigem permissão financeira específica.</p>;
  }

  return (
    <section className="space-y-5">
      {message && <p aria-live="polite" className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-900" role="status">{message}</p>}

      <AssessmentHistory
        financial={financial[0]}
        loading={busy === "loading"}
        payment={payment[0]}
        subjectName={subject?.name}
      />

      {canAssessFinancial && (
        <details className="rounded-xl border border-slate-200 bg-slate-50">
          <summary className="cursor-pointer px-4 py-3 text-xs font-black text-slate-900">Registrar capacidade financeira</summary>
          <form className="grid gap-3 border-t border-slate-200 p-4 sm:grid-cols-2" onSubmit={submitFinancial}>
            <DateFields/>
            <label className="grid gap-1 text-xs font-bold text-slate-700 sm:col-span-2">Conclusão
              <select className={fieldClass} defaultValue="INSUFFICIENT_DATA" name="conclusion">
                <option value="ADEQUATE">Adequada</option>
                <option value="HIGH_RISK">Alto risco</option>
                <option value="INSUFFICIENT_DATA">Dados insuficientes</option>
              </select>
            </label>
            <p className="sm:col-span-2 text-[10px] leading-4 text-slate-500">Para “Adequada” ou “Alto risco”, preencha um índice formal. Em “Dados insuficientes”, os campos do índice são ignorados.</p>
            <label className="grid gap-1 text-xs font-bold text-slate-700">Código do índice<input className={fieldClass} name="indexCode" placeholder="LG, LC, SG"/></label>
            <label className="grid gap-1 text-xs font-bold text-slate-700">Nome do índice<input className={fieldClass} name="indexName" placeholder="Liquidez geral"/></label>
            <label className="grid gap-1 text-xs font-bold text-slate-700 sm:col-span-2">Fórmula aplicada<input className={fieldClass} name="formulaDescription" placeholder="Ativo circulante / passivo circulante"/></label>
            <label className="grid gap-1 text-xs font-bold text-slate-700">Critério<select className={fieldClass} defaultValue="GTE" name="comparison"><option value="GTE">Maior ou igual</option><option value="LTE">Menor ou igual</option><option value="EQ">Igual</option></select></label>
            <label className="grid gap-1 text-xs font-bold text-slate-700">Limite exigido<input className={fieldClass} name="requiredLimit" step="any" type="number"/></label>
            <label className="grid gap-1 text-xs font-bold text-slate-700">Valor apurado<input className={fieldClass} name="actualValue" step="any" type="number"/></label>
            <EvidenceFields/>
            <JustificationField/>
            <SubmitButton busy={busy === "financial"} label="Registrar capacidade"/>
          </form>
        </details>
      )}

      {canAssessClientRisk && subject && (
        <details className="rounded-xl border border-slate-200 bg-slate-50">
          <summary className="cursor-pointer px-4 py-3 text-xs font-black text-slate-900">Registrar desempenho de pagamento · {subject.name}</summary>
          <form className="grid gap-3 border-t border-slate-200 p-4 sm:grid-cols-2" onSubmit={submitPayment}>
            <DateFields/>
            <label className="grid gap-1 text-xs font-bold text-slate-700 sm:col-span-2">Classificação formal
              <select className={fieldClass} defaultValue="INSUFFICIENT_DATA" name="classification">
                <option value="GOOD_PAYER">Bom pagador</option>
                <option value="ATTENTION">Atenção</option>
                <option value="NON_PAYER">Não pagador</option>
                <option value="INSUFFICIENT_DATA">Dados insuficientes</option>
              </select>
            </label>
            <MetricField label="Faturas avaliadas" name="invoiceCount"/>
            <MetricField label="Faturas em atraso" name="overdueCount"/>
            <MetricField label="Atraso médio (dias)" name="averageDelayDays"/>
            <MetricField label="Valor vencido" name="overdueAmount" step="0.01"/>
            <label className="grid gap-1 text-xs font-bold text-slate-700">Moeda<input className={fieldClass} defaultValue="BRL" maxLength={3} minLength={3} name="currency"/></label>
            <EvidenceFields/>
            <JustificationField/>
            <SubmitButton busy={busy === "payment"} label="Registrar pagamento"/>
          </form>
        </details>
      )}

      {!subject && <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">Vincule um cliente ou órgão contratante à oportunidade para registrar o desempenho de pagamento.</p>}
    </section>
  );
}

function AssessmentHistory({ financial, payment, subjectName, loading }: { financial?: FinancialRecord; payment?: PaymentRecord; subjectName?: string; loading: boolean }) {
  if (loading) return <p className="text-xs text-slate-500">Consultando avaliações formais…</p>;
  return <div className="grid gap-3 sm:grid-cols-2">
    <HistoryCard
      detail={financial ? financial.justification : "Nenhum registro formal para esta oportunidade."}
      label="Capacidade financeira"
      meta={financial ? `Versão ${financial.version} · ${dateLabel(financial.periodStart)} a ${dateLabel(financial.periodEnd)}` : "Pendente"}
      value={financial ? financial.conclusion : "SEM AVALIAÇÃO"}
    />
    <HistoryCard
      detail={payment ? payment.justification : subjectName ? `Nenhum registro formal para ${subjectName}.` : "Cliente ou órgão não vinculado."}
      label="Desempenho de pagamento"
      meta={payment ? `Versão ${payment.version} · ${dateLabel(payment.periodStart)} a ${dateLabel(payment.periodEnd)}` : "Pendente"}
      value={payment ? payment.classification : "SEM AVALIAÇÃO"}
    />
  </div>;
}

function HistoryCard({ label, value, meta, detail }: { label: string; value: string; meta: string; detail: string }) {
  return <article className="rounded-xl border border-slate-200 p-4"><p className="text-[9px] font-black uppercase tracking-wide text-slate-400">{label}</p><p className="mt-2 text-sm font-black text-slate-900">{value.replaceAll("_", " ")}</p><p className="mt-1 text-[10px] text-slate-500">{meta}</p><p className="mt-3 line-clamp-3 text-xs leading-5 text-slate-600">{detail}</p></article>;
}

function DateFields() {
  return <><label className="grid gap-1 text-xs font-bold text-slate-700">Início do período<input className={fieldClass} defaultValue={today()} name="periodStart" required type="date"/></label><label className="grid gap-1 text-xs font-bold text-slate-700">Fim do período<input className={fieldClass} defaultValue={today()} name="periodEnd" required type="date"/></label></>;
}

function EvidenceFields() {
  return <><label className="grid gap-1 text-xs font-bold text-slate-700 sm:col-span-2">Fonte / documento de evidência<input className={fieldClass} maxLength={500} minLength={2} name="sourceReference" placeholder="Relatório, balanço, controle financeiro ou URL autorizada" required/></label><label className="grid gap-1 text-xs font-bold text-slate-700">Data da fonte<input className={fieldClass} defaultValue={today()} name="sourceDate" required type="date"/></label></>;
}

function JustificationField() {
  return <label className="grid gap-1 text-xs font-bold text-slate-700 sm:col-span-2">Justificativa técnica<textarea className={`${fieldClass} min-h-24`} maxLength={5000} minLength={20} name="justification" placeholder="Explique a conclusão com base nas evidências autorizadas." required/></label>;
}

function MetricField({ label, name, step = "1" }: { label: string; name: string; step?: string }) {
  return <label className="grid gap-1 text-xs font-bold text-slate-700">{label}<input className={fieldClass} min="0" name={name} step={step} type="number"/></label>;
}

function SubmitButton({ busy, label }: { busy: boolean; label: string }) {
  return <button className="w-fit rounded-lg bg-brand px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50 sm:col-span-2" disabled={busy} type="submit">{busy ? "Registrando…" : label}</button>;
}
