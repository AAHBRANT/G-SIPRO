import { notFound } from "next/navigation";

import { PageHeader } from "@/components/ui/page-header";
import { getCurrentAuthorizationContext } from "@/core/authorization/authorization-context";
import { getDatabase } from "@/core/database/prisma";

import { NotificationCenter } from "./notification-center";

export default async function NotificationsPage() {
  const authorization = await getCurrentAuthorizationContext();
  if (!authorization?.permissions.has("notifications.read")) notFound();
  const notifications = await getDatabase().userNotification.findMany({
    where: { recipientId: authorization.actorId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return <main className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
    <PageHeader eyebrow="Atendimento" icon="file" subtitle="Acompanhe decisões, impedimentos, pendências e próximos passos destinados a você." title="Notificações"/>
    <div className="mt-6"><NotificationCenter initialNotifications={notifications.map((item) => ({ id: item.id, type: item.type, summary: item.summary, nextAction: item.nextAction, deepLink: item.deepLink, readAt: item.readAt?.toISOString() ?? null, createdAt: item.createdAt.toISOString() }))}/></div>
  </main>;
}
