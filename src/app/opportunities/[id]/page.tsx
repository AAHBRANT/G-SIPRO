import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { getCurrentAuthorizationContext } from "@/core/authorization/authorization-context";
import { authorize } from "@/core/authorization/policy";
import { getDatabase } from "@/core/database/prisma";

import { OpportunityEditor, type OpportunityEditorData } from "./opportunity-editor";

const statusLabels = { DRAFT: "Rascunho", QUALIFICATION: "Qualificação", ACTIVE: "Ativa", SUSPENDED: "Suspensa", CLOSED: "Encerrada" } as const;

function localDateTime(value: Date | null): string | undefined {
  if (!value) return undefined;
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export default async function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const authorization = await getCurrentAuthorizationContext();
  if (!authorize(authorization, { permission: "opportunities.read" }).allowed) notFound();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();

  const [record, users] = await Promise.all([
    getDatabase().opportunity.findUnique({
      where: { id: id.data },
      include: { history: { orderBy: { version: "desc" } } },
    }),
    getDatabase().user.findMany({ where: { status: "ACTIVE" }, orderBy: { displayName: "asc" } }),
  ]);
  if (!record) notFound();

  const opportunity: OpportunityEditorData = {
    id: record.id,
    code: record.code,
    origin: record.origin,
    status: record.status,
    ...(record.subject && { subject: record.subject }),
    ...(record.estimatedValue !== null && { estimatedValue: record.estimatedValue.toString() }),
    ...(record.currency && { currency: record.currency }),
    ...(record.valueSource && { valueSource: record.valueSource }),
    ...(localDateTime(record.publishedAt) && { publishedAt: localDateTime(record.publishedAt) }),
    ...(localDateTime(record.deliveryAt) && { deliveryAt: localDateTime(record.deliveryAt) }),
    ...(record.datesSource && { datesSource: record.datesSource }),
    ...(record.datesTimeZone && { datesTimeZone: record.datesTimeZone }),
    ...(record.ownerId && { ownerId: record.ownerId }),
  };

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-6 py-10 lg:px-10">
      <div><Link className="text-sm font-bold text-brand" href="/opportunities">← Voltar às oportunidades</Link>
        <div className="mt-6 flex flex-wrap items-center gap-3"><h1 className="text-3xl font-bold">{record.code}</h1>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold">{statusLabels[record.status]}</span>
          <span className="text-sm text-muted">Versão {record.version}</span>
        </div>
      </div>
      <OpportunityEditor
        opportunity={opportunity}
        users={users.map((user) => ({ id: user.id, name: user.displayName }))}
        canUpdate={authorize(authorization, { permission: "opportunities.update" }).allowed}
        canTransition={authorize(authorization, { permission: "opportunities.transition" }).allowed}
      />
      <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-xl font-bold">Histórico imutável</h2>
        <ol className="mt-4 space-y-3">
          {record.history.map((entry) => <li className="rounded-xl border border-border p-4 text-sm" key={entry.id}>
            <div className="flex flex-wrap justify-between gap-2"><strong>Versão {entry.version} · {entry.action}</strong><span className="text-muted">{entry.changedAt.toLocaleString("pt-BR")}</span></div>
            <p className="mt-1 text-muted">Situação: {statusLabels[entry.toStatus]}{entry.reason ? ` · Motivo: ${entry.reason}` : ""}</p>
          </li>)}
        </ol>
      </section>
    </main>
  );
}
