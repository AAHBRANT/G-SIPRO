import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentAuthorizationContext } from "@/core/authorization/authorization-context";
import { authorize } from "@/core/authorization/policy";
import { getDatabase } from "@/core/database/prisma";
import { AiExtractionForm } from "./ai-extraction-form";

const proposalScopedUseCase = "GSIPRO_ANALISE_EDITAL_TR_ETP";

export default async function AiExtractionsPage() {
  const auth = await getCurrentAuthorizationContext();
  if (!auth || !authorize(auth, { permission: "ai.read" }).allowed) notFound();

  const canReadDocuments = authorize(auth, { permission: "documents.read" }).allowed;
  const database = getDatabase();
  const [allCases, documents, executions] = await Promise.all([
    database.aiUseCaseDefinition.findMany({
      include: { approval: true, modelVersion: true },
      orderBy: [{ code: "asc" }, { version: "desc" }],
    }),
    canReadDocuments
      ? database.managedDocumentVersion.findMany({
          include: { document: true },
          orderBy: { createdAt: "desc" },
          take: 200,
        })
      : Promise.resolve([]),
    database.aiExtractionExecution.findMany({
      include: {
        definition: true,
        modelVersion: true,
        documentVersion: { include: { document: true } },
        evidence: true,
      },
      orderBy: { startedAt: "desc" },
      take: 100,
    }),
  ]);

  const latestCases = allCases.filter(
    (item) => !allCases.some(
      (other) => other.useCaseKey === item.useCaseKey && other.version > item.version,
    ),
  );
  const executableCases = latestCases.filter(
    (item) =>
      item.code !== proposalScopedUseCase &&
      item.approval &&
      item.modelVersion.status === "ACTIVE" &&
      item.modelVersion.provider.toUpperCase() === "OPENAI" &&
      item.modelVersion.serviceType.toUpperCase().includes("RESPONSES"),
  );
  const sourceTypes = new Set(
    executableCases.flatMap((item) =>
      (item.authorizedSources as Array<{ documentType: string; requiredPermission: string }>)
        .filter((source) => authorize(auth, { permission: source.requiredPermission }).allowed)
        .map((source) => source.documentType),
    ),
  );
  const visibleDocuments = documents.filter((item) => sourceTypes.has(item.document.type));
  const visibleExecutions = executions.filter(
    (item) => item.definition.code !== proposalScopedUseCase,
  );
  const canExecute = authorize(auth, { permission: "ai.execute" }).allowed && canReadDocuments;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10">
      <header>
        <Link className="text-sm font-bold text-brand" href="/">← Início</Link>
        <p className="mt-6 text-sm font-bold uppercase tracking-wider text-purple-700">
          Incremento I5 · BL-502
        </p>
        <h1 className="mt-1 text-3xl font-bold">Extração documental com OpenAI</h1>
        <p className="mt-2 text-muted">
          Execuções assistivas, idempotentes e rastreáveis por modelo, fonte imutável e evidência.
        </p>
        <Link className="mt-3 inline-block text-sm font-bold text-purple-700" href="/ai-governance">
          Administrar modelos e casos de uso →
        </Link>
      </header>

      <section className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        <strong>Editais, termos de referência, ETPs e anexos são analisados dentro da proposta.</strong>
        <p className="mt-1">
          Isso garante que a IA consulte somente os arquivos vinculados àquela oportunidade e não
          misture documentos de assuntos diferentes.
        </p>
        <Link className="mt-2 inline-block font-bold text-brand" href="/proposals">
          Ir para Propostas →
        </Link>
      </section>

      {canExecute ? (
        <AiExtractionForm
          useCases={executableCases.map((item) => ({
            id: item.id,
            label: `${item.code} · v${item.version} · ${item.modelVersion.providerModelVersion}`,
          }))}
          documents={visibleDocuments.map((item) => ({
            id: item.id,
            label: `${item.document.type} · ${item.document.title} · v${item.version} · ${item.fileHash.slice(0, 12)}`,
          }))}
        />
      ) : (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
          A execução exige as permissões <b>ai.execute</b>, <b>documents.read</b> e a permissão
          definida para a fonte no caso de uso.
        </p>
      )}

      <section className="grid gap-4">
        {visibleExecutions.length === 0 && (
          <p className="rounded-xl border p-4 text-sm text-muted">Nenhuma execução registrada.</p>
        )}
        {visibleExecutions.map((item) => {
          const content = Array.isArray(item.output)
            ? item.output as Array<{ field?: string; value?: string }>
            : [];
          const limitations = Array.isArray(item.limitations)
            ? item.limitations as string[]
            : [];
          return (
            <article className="rounded-2xl border border-border bg-surface p-6" key={item.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-purple-700">
                    {item.definition.code} · caso v{item.definition.version}
                  </p>
                  <h2 className="text-xl font-bold">{item.documentVersion.document.title}</h2>
                </div>
                <strong className={item.status === "SUCCEEDED" ? "text-emerald-700" : "text-rose-700"}>
                  {item.status}
                </strong>
              </div>
              <p className="mt-2 text-xs">
                OpenAI · {item.modelVersion.providerModelVersion} · modelo inventário v{item.modelVersion.version}
              </p>
              {item.status === "FAILED" ? (
                <p className="mt-3 rounded-lg bg-rose-50 p-3 text-sm">
                  {item.errorCode}: {item.errorMessage}
                </p>
              ) : (
                <>
                  <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs font-bold">
                    CONTEÚDO ASSISTIVO — validação humana obrigatória · confiança {item.confidence?.toString() ?? "não informada"}
                  </p>
                  <div className="mt-3 grid gap-2">
                    {content.map((entry, index) => (
                      <p className="rounded-lg bg-background p-3 text-sm" key={`${entry.field}-${index}`}>
                        <b>{entry.field}:</b> {entry.value}
                      </p>
                    ))}
                  </div>
                  {limitations.length > 0 && (
                    <p className="mt-3 text-xs"><b>Limitações:</b> {limitations.join(" · ")}</p>
                  )}
                </>
              )}
            </article>
          );
        })}
      </section>
    </main>
  );
}
