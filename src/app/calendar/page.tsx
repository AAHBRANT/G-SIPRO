import { PageHeader } from "@/components/ui/page-header";
import { getCurrentAuthorizationContext } from "@/core/authorization/authorization-context";
import { authorize } from "@/core/authorization/policy";
import { getDatabase } from "@/core/database/prisma";
import { CalendarView } from "./calendar-view";

export default async function CalendarPage() {
  const authorization = await getCurrentAuthorizationContext();
  if (!authorize(authorization, { permission: "calendar.read" }).allowed) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center px-6 py-10">
        <section className="w-full rounded-2xl border border-amber-200 bg-amber-50 p-8">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-800">Controle de acesso</p>
          <h1 className="mt-2 text-2xl font-black text-amber-950">Acesso aguardando provisionamento</h1>
          <p className="mt-3 leading-7 text-amber-900">Sua identidade foi reconhecida, mas nenhum perfil aprovado concede consulta ao calendário. Solicite ao administrador a atribuição formal do perfil adequado.</p>
        </section>
      </main>
    );
  }

  const canManage = authorize(authorization, { permission: "calendar.manage" }).allowed;
  const users = await getDatabase().user.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, displayName: true },
    orderBy: { displayName: "asc" },
  });

  return (
    <main className="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      <PageHeader eyebrow="Comercial" icon="calendar" subtitle="Prazos de editais, entregas de proposta e compromissos de equipe em um único lugar." title="Calendário" variant="executive" />
      <CalendarView canManage={canManage} users={users.map((user) => ({ id: user.id, name: user.displayName }))} />
    </main>
  );
}
