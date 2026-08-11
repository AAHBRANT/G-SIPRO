"use client";

import { useState, useTransition } from "react";

import {
  conditionTreatments,
  scoutConditions,
  scoutWorkTypes,
  type ConditionTreatment,
  type ScoutCondition,
  type ScoutFilter,
  type ScoutWorkType,
} from "@/modules/scouting/domain/scout-filter";

const workTypeLabels: Record<ScoutWorkType, string> = {
  BUILDING: "Edificação",
  SPECIAL_STRUCTURE: "Obra de arte especial",
  PAVING: "Pavimentação e rodovia",
  URBAN_INFRASTRUCTURE: "Infraestrutura urbana",
  SANITATION: "Saneamento e adutora",
  EARTHWORKS: "Contenção e terraplenagem",
  RENOVATION: "Reforma e retrofit",
};

const conditionLabels: Record<ScoutCondition, { title: string; hint: string }> = {
  IN_PERSON_SESSION: { title: "Sessão presencial", hint: "Exige comparecimento no órgão — deslocamento e custo" },
  REGISTRATION_REQUIRED: { title: "Cadastro ou CRC obrigatório", hint: "Registro prévio como condição de participação" },
  CONSORTIUM_FORBIDDEN: { title: "Consórcio vedado", hint: "Impede a disputa em conjunto com outra construtora" },
  TENDER_BOND: { title: "Garantia de proposta (fiança)", hint: "Exige caução ou seguro — imobiliza capital" },
  UNIT_PRICE_COMPOSITION: { title: "Composição de preços unitários", hint: "Exige CPU detalhada de cada item da planilha" },
  TECHNICAL_PROPOSAL: { title: "Proposta técnica", hint: "Julgamento por técnica e preço — documentação adicional" },
  MANDATORY_SITE_VISIT: { title: "Visita técnica obrigatória", hint: "Exige ida ao local antes da proposta" },
};

const treatmentLabels: Record<ConditionTreatment, string> = { IGNORE: "Indiferente", FLAG: "Sinalizar", DISCARD: "Descartar" };
const treatmentStyles: Record<ConditionTreatment, string> = {
  IGNORE: "bg-slate-200 text-slate-800",
  FLAG: "bg-amber-100 text-amber-900",
  DISCARD: "bg-brand text-white",
};

const spheres = [{ id: "F", label: "Federal" }, { id: "E", label: "Estadual" }, { id: "M", label: "Municipal" }, { id: "D", label: "Distrital" }] as const;

const toList = (value: string) => value.split(",").map((entry) => entry.trim()).filter(Boolean);
const fieldClass = "h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-brand";
const labelClass = "mb-1.5 block text-[11px] font-black uppercase tracking-wide text-slate-500";

export function ScoutFilterForm({ filter, readOnly }: { filter: ScoutFilter; readOnly: boolean }) {
  const [draft, setDraft] = useState<ScoutFilter>(filter);
  const [message, setMessage] = useState<string>();
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  const update = <Key extends keyof ScoutFilter>(key: Key, value: ScoutFilter[Key]) => setDraft((current) => ({ ...current, [key]: value }));

  const toggleWorkType = (workType: ScoutWorkType) => update(
    "workTypes",
    draft.workTypes.includes(workType) ? draft.workTypes.filter((entry) => entry !== workType) : [...draft.workTypes, workType],
  );

  const toggleSphere = (sphere: (typeof spheres)[number]["id"]) => update(
    "spheres",
    draft.spheres.includes(sphere) ? draft.spheres.filter((entry) => entry !== sphere) : [...draft.spheres, sphere],
  );

  const setTreatment = (condition: ScoutCondition, treatment: ConditionTreatment) =>
    update("conditionTreatments", { ...draft.conditionTreatments, [condition]: treatment });

  function save() {
    startTransition(async () => {
      const response = await fetch("/api/scouting/filters", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      setFailed(!response.ok);
      setMessage(response.ok ? "Filtros salvos." : "Não foi possível salvar os filtros.");
    });
  }

  return <>
    <section className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-base font-black text-slate-900">1. Onde e o que procurar</h2>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-slate-600">Filtra na busca</span>
      </div>
      <p className="mt-1 text-xs leading-5 text-slate-500">Aplicado direto na consulta ao PNCP. Só entra na fila o que passar por aqui.</p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="includeKeywords">Palavras no objeto — incluir</label>
          <input className={fieldClass} defaultValue={draft.includeKeywords.join(", ")} disabled={readOnly} id="includeKeywords" onBlur={(event) => update("includeKeywords", toList(event.target.value))}/>
          <p className="mt-1 text-[11px] text-slate-400">Separe por vírgula. Basta uma delas aparecer.</p>
        </div>
        <div>
          <label className={labelClass} htmlFor="excludeKeywords">Palavras no objeto — excluir</label>
          <input className={fieldClass} defaultValue={draft.excludeKeywords.join(", ")} disabled={readOnly} id="excludeKeywords" onBlur={(event) => update("excludeKeywords", toList(event.target.value))}/>
          <p className="mt-1 text-[11px] text-slate-400">Descarta o certame se qualquer uma aparecer.</p>
        </div>
      </div>

      <fieldset className="mt-4">
        <legend className={labelClass}>Tipo de obra</legend>
        <div className="flex flex-wrap gap-2">
          {scoutWorkTypes.map((workType) => {
            const active = draft.workTypes.includes(workType);
            return <button className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${active ? "border-brand bg-brand text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`} disabled={readOnly} key={workType} onClick={() => toggleWorkType(workType)} type="button">{workTypeLabels[workType]}</button>;
          })}
        </div>
      </fieldset>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div>
          <label className={labelClass} htmlFor="states">Estados</label>
          <input className={fieldClass} defaultValue={draft.states.join(", ")} disabled={readOnly} id="states" onBlur={(event) => update("states", toList(event.target.value).map((entry) => entry.toUpperCase()))} placeholder="Vazio = Brasil inteiro"/>
        </div>
        <div>
          <label className={labelClass} htmlFor="minimumValue">Valor mínimo (R$)</label>
          <input className={fieldClass} defaultValue={draft.minimumValue ?? ""} disabled={readOnly} id="minimumValue" inputMode="numeric" onBlur={(event) => update("minimumValue", event.target.value ? Number(event.target.value) : undefined)}/>
        </div>
        <div>
          <label className={labelClass} htmlFor="maximumValue">Valor máximo (R$)</label>
          <input className={fieldClass} defaultValue={draft.maximumValue ?? ""} disabled={readOnly} id="maximumValue" inputMode="numeric" onBlur={(event) => update("maximumValue", event.target.value ? Number(event.target.value) : undefined)}/>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <fieldset>
          <legend className={labelClass}>Esfera</legend>
          <div className="flex flex-wrap gap-3">
            {spheres.map((sphere) => <label className="flex items-center gap-2 text-sm text-slate-700" key={sphere.id}>
              <input checked={draft.spheres.includes(sphere.id)} disabled={readOnly} onChange={() => toggleSphere(sphere.id)} type="checkbox"/>
              {sphere.label}
            </label>)}
          </div>
        </fieldset>
        <div>
          <label className={labelClass} htmlFor="minimumDaysToClose">Prazo mínimo até o encerramento</label>
          <select className={fieldClass} defaultValue={draft.minimumDaysToClose} disabled={readOnly} id="minimumDaysToClose" onChange={(event) => update("minimumDaysToClose", Number(event.target.value))}>
            {[5, 10, 15, 20, 30].map((days) => <option key={days} value={days}>{days} dias</option>)}
          </select>
        </div>
        <label className="flex items-end gap-2 pb-2 text-sm text-slate-700">
          <input checked={draft.includeUndisclosedValue} disabled={readOnly} onChange={(event) => update("includeUndisclosedValue", event.target.checked)} type="checkbox"/>
          Trazer certames com valor sigiloso
        </label>
      </div>
    </section>

    <section className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-base font-black text-slate-900">2. Condições do certame</h2>
        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-900">Lido no edital</span>
      </div>
      <p className="mt-1 text-xs leading-5 text-slate-500">Não constam da consulta pública — só são conhecidas quando o edital e o termo de referência são lidos. Por isso agem depois da varredura.</p>

      <ul className="mt-3 divide-y divide-slate-100">
        {scoutConditions.map((condition) => {
          const current = draft.conditionTreatments[condition] ?? "IGNORE";
          return <li className="flex flex-wrap items-center justify-between gap-3 py-3" key={condition}>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">{conditionLabels[condition].title}</p>
              <p className="text-xs text-slate-500">{conditionLabels[condition].hint}</p>
            </div>
            <div className="flex overflow-hidden rounded-lg border border-slate-200">
              {conditionTreatments.map((treatment) => <button
                className={`border-r border-slate-200 px-3 py-2 text-xs font-semibold last:border-r-0 ${current === treatment ? treatmentStyles[treatment] : "bg-white text-slate-600 hover:bg-slate-50"}`}
                disabled={readOnly}
                key={treatment}
                onClick={() => setTreatment(condition, treatment)}
                type="button"
              >{treatmentLabels[treatment]}</button>)}
            </div>
          </li>;
        })}
      </ul>

      <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
        <strong>Cuidado com o descarte:</strong> ele é silencioso — a licitação sai da fila sem que ninguém veja. Reserve-o ao que a empresa comprovadamente não atende; para o resto, prefira sinalizar.
      </p>
    </section>

    {!readOnly && <div className="mt-4 flex items-center gap-3">
      <button className="rounded-lg bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[var(--brand-strong)] disabled:opacity-60" disabled={pending} onClick={save} type="button">
        {pending ? "Salvando…" : "Salvar filtros"}
      </button>
      {message && <span className={`text-sm ${failed ? "text-brand" : "text-emerald-700"}`} role="status">{message}</span>}
    </div>}
  </>;
}
