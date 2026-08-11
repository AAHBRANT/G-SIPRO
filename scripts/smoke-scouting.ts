/**
 * Verificação de ponta a ponta do Buscador G-SIPRO contra um banco real.
 *
 * Consulta o PNCP de verdade, aplica o funil, grava a fila e faz a triagem —
 * confirmando que a oportunidade nasce com origem BUSCADOR, status "Em análise"
 * e responsável igual a quem aprovou.
 *
 * Executar apenas contra o PostgreSQL local descartável.
 */
import { randomUUID } from "node:crypto";

import { getDatabase } from "@/core/database/prisma";
import { ScoutService } from "@/modules/scouting/application/scout-service";
import { TriageService } from "@/modules/scouting/application/triage-service";
import { defaultScoutFilter } from "@/modules/scouting/domain/scout-filter";
import { PncpClient } from "@/modules/scouting/infrastructure/pncp-client";
import { OpportunityFromScoutedTender, PrismaScoutRepository, PrismaTriageRepository } from "@/modules/scouting/infrastructure/prisma-scouting-repository";

const database = getDatabase();

function step(title: string) {
  console.log(`\n=== ${title} ===`);
}

async function main() {
  step("1. Usuário de teste");
  const actorId = randomUUID();
  await database.user.create({
    data: { id: actorId, entraObjectId: randomUUID(), displayName: "Ana Cláudia (teste)", email: `teste-${actorId.slice(0, 8)}@aahbrant.com`, createdBy: actorId, updatedBy: actorId },
  });
  console.log("criado:", actorId);

  step("2. Salvar filtros (restritos ao Ceará para a varredura ser rápida)");
  const repository = new PrismaScoutRepository();
  await repository.saveFilter({ ...defaultScoutFilter, states: ["CE"], minimumDaysToClose: 5 }, actorId);
  const reloaded = await repository.loadFilter();
  console.log("filtros gravados e relidos:", reloaded?.states, "| dias mínimos:", reloaded?.minimumDaysToClose);

  step("3. Varredura contra o PNCP real");
  const finalDate = new Date();
  finalDate.setMonth(finalDate.getMonth() + 12);
  const summary = await new ScoutService(repository, new PncpClient({ finalDate, states: ["CE"] })).run("MANUAL");
  console.log("encontradas:", summary.totalFetched, "| enquadradas:", summary.totalQualified, "| novas na fila:", summary.totalNew);

  step("4. Fila gravada");
  const queue = await database.scoutedTender.findMany({ where: { status: "PENDING" }, orderBy: { proposalClosesAt: "asc" }, take: 3 });
  for (const entry of queue) {
    console.log(`- ${entry.subject.slice(0, 70)}… | ${entry.authorityName.slice(0, 30)} | ${entry.valueUndisclosed ? "sigiloso" : entry.estimatedValue} | encerra ${entry.proposalClosesAt?.toLocaleDateString("pt-BR")}`);
  }
  if (queue.length === 0) throw new Error("Nada entrou na fila — verificar filtros ou disponibilidade do portal.");

  step("5. Nada já visto pode voltar à fila");
  // Verificação direta no banco: repetir a varredura não serve de prova, porque
  // uma instabilidade do portal devolveria zero e o resultado pareceria correto
  // sem ter testado nada.
  const seen = await database.scoutedTender.findMany({ select: { externalId: true, status: true } });
  const recognized = await repository.findKnownExternalIds(seen.map((entry) => entry.externalId));
  console.log("na fila/histórico:", seen.length, "| reconhecidas como já vistas:", recognized.length, recognized.length === seen.length ? "✔" : "✘");
  console.log("licitação inédita é reconhecida como nova:", (await repository.findKnownExternalIds(["inexistente-999"])).length === 0 ? "✔" : "✘");

  step("6. Aprovar a primeira da fila");
  const triage = new TriageService(new PrismaTriageRepository(), new OpportunityFromScoutedTender());
  const target = queue[0]!;
  const opportunityId = await triage.approve(target.id, actorId, randomUUID());
  const created = await database.opportunity.findUniqueOrThrow({ where: { id: opportunityId }, include: { owner: true, contractingAuthority: true } });
  console.log("código:", created.code);
  console.log("origem:", created.origin, created.origin === "BUSCADOR" ? "✔" : "✘");
  console.log("status:", created.status, created.status === "QUALIFICATION" ? "✔ (Em análise)" : "✘");
  console.log("responsável:", created.owner?.displayName, created.ownerId === actorId ? "✔ (quem aprovou)" : "✘");
  console.log("valor:", created.estimatedValue?.toString() ?? "(sigiloso)");
  console.log("prazo:", created.deliveryAt?.toLocaleDateString("pt-BR"));
  console.log("objeto:", created.subject?.slice(0, 70), "…");

  step("7. Descartar a segunda, com motivo");
  const discarded = queue[1];
  if (discarded) {
    await triage.discard(discarded.id, actorId, "Fora da região de atuação (teste)");
    const after = await database.scoutedTender.findUniqueOrThrow({ where: { id: discarded.id } });
    console.log("situação:", after.status, "| motivo:", after.decisionReason, "| autor registrado:", after.decidedById === actorId ? "✔" : "✘");
  }

  step("8. Contadores da tela");
  console.log("aguardando triagem:", await triage.pendingCount());
  console.log("oportunidades criadas pelo Buscador:", await database.opportunity.count({ where: { origin: "BUSCADOR" } }));

  step("RESULTADO");
  console.log("Fluxo completo executado contra banco e portal reais.");
}

main().catch((error) => { console.error("\nFALHOU:", error); process.exit(1); }).finally(() => database.$disconnect());
