/**
 * Confere se a leitura de edital está DE FATO liberada pela governança de IA
 * — a mesma pergunta que `PrismaEditalExtraction.approvedDefinition` faz em
 * produção a cada tentativa de leitura, só que aqui é você conferindo antes de
 * gastar uma licitação de verdade.
 *
 * SOMENTE LEITURA. Não escreve, não apaga, não aprova nada.
 *
 * Uso:
 *   DATABASE_URL="<a conexão de leitura do G-SIPRO>" \
 *     ./node_modules/.bin/tsx scripts/verificar-governanca-edital.mts
 */
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client.js";

const DOCUMENT_TYPE = "EDITAL";

const conexao = process.env.DATABASE_URL;
if (!conexao) {
  console.error("Informe DATABASE_URL. Nada é gravado: o script só lê.");
  process.exit(1);
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: conexao }) });

async function main(): Promise<void> {
  console.log(`\n═══ CASOS DE USO QUE CITAM "${DOCUMENT_TYPE}" EM authorizedSources ═══\n`);

  // ⚠️ NÃO filtra por `code`: esse campo é um rótulo livre do caso de uso, e
  // nada garante que valha "EDITAL" — o que realmente liga um caso de uso ao
  // tipo documental é `authorizedSources`, e é assim que o serviço real
  // (`PrismaEditalExtraction.approvedDefinition`) decide. Filtrar por `code`
  // aqui poderia dizer "não cadastrado" quando na verdade está, só que sob
  // outro nome.
  const candidatos = await db.aiUseCaseDefinition.findMany({
    select: {
      id: true, version: true, code: true, createdBy: true, effectiveFrom: true, authorizedSources: true,
      nextVersions: { select: { id: true } },
      modelVersion: { select: { status: true, providerModelVersion: true } },
      approval: { select: { approvedBy: true, approvedAt: true } },
    },
    orderBy: { version: "desc" },
  });

  const todos = candidatos.filter((d) =>
    Array.isArray(d.authorizedSources)
    && (d.authorizedSources as Array<{ documentType?: unknown }>).some((f) => f.documentType === DOCUMENT_TYPE));

  if (todos.length === 0) {
    console.log(`Nenhum caso de uso, dos ${candidatos.length} cadastrados no total, cita "${DOCUMENT_TYPE}"`);
    console.log(`em authorizedSources. Confira se o campo foi preenchido com "EDITAL | documents.read"`);
    console.log(`(ou similar) — é o texto exato ali que decide, não o código do caso de uso.`);
    await db.$disconnect();
    return;
  }

  for (const d of todos) {
    console.log(`"${d.code}" — versão ${d.version} (id ${d.id})`);
    console.log(`  criado por:        ${d.createdBy}`);
    console.log(`  modelo:            ${d.modelVersion.providerModelVersion} — status ${d.modelVersion.status}`);
    console.log(`  aprovação:         ${d.approval ? `SIM, por ${d.approval.approvedBy} em ${d.approval.approvedAt.toISOString()}` : "NÃO"}`);
    if (d.approval && d.approval.approvedBy === d.createdBy) {
      console.log(`  ⚠️  quem aprovou é quem cadastrou — a governança EXIGE pessoas diferentes.`);
      console.log(`      esta aprovação não conta, mesmo estando gravada.`);
    }
    console.log(`  é a versão vigente: ${d.nextVersions.length === 0 ? "SIM" : "NÃO — existe versão mais nova"}`);
    const fontes = Array.isArray(d.authorizedSources)
      ? (d.authorizedSources as Array<{ documentType?: unknown }>).map((f) => f.documentType).join(", ")
      : "(formato inesperado)";
    console.log(`  fontes autorizadas: ${fontes || "(vazio)"}`);
    console.log("");
  }

  // A MESMA condição que o serviço real usa — se aparecer aqui, a leitura
  // funciona; se não aparecer, um dos campos acima é o motivo.
  const liberado = todos.find((d) =>
    d.approval
    && d.approval.approvedBy !== d.createdBy
    && d.modelVersion.status === "ACTIVE"
    && d.nextVersions.length === 0
    && Array.isArray(d.authorizedSources)
    && (d.authorizedSources as Array<{ documentType?: unknown }>).some((f) => f.documentType === DOCUMENT_TYPE));

  console.log("═══ RESULTADO ═══\n");
  console.log(liberado
    ? `LIBERADO — a próxima leitura de edital vai rodar de verdade (versão ${liberado.version}).`
    : "AINDA BLOQUEADO — veja acima qual condição falta: aprovação por pessoa diferente,\n"
      + "modelo ativo, ser a versão vigente, ou EDITAL entre as fontes autorizadas.");
}

main()
  .catch((erro: unknown) => {
    console.error(erro instanceof Error ? erro.message : erro);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
