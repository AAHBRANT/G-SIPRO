import type { Metadata } from "next";
import { auth, signOut } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { getCurrentAuthorizationContext } from "@/core/authorization/authorization-context";
import { getDatabase } from "@/core/database/prisma";
import "./globals.css";

export const metadata: Metadata = {
  title: "G-SIPRO",
  description: "Sistema Inteligente de Gestão de Propostas",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  const authorization = await getCurrentAuthorizationContext();
  const userLabel = session?.user?.name ?? session?.user?.email ?? "Usuário corporativo";
  const permissions = [...(authorization?.permissions ?? [])];
  const pendingApprovals = authorization?.isOwner
    ? (await Promise.all([
        getDatabase().supportTicket.count({ where: { status: { in: ["WAITING_APPROVAL", "OWNER_ACTION_REQUIRED", "ESCALATED"] } } }),
        getDatabase().intelligencePolicy.count({ where: { approval: null } }),
      ])).reduce((total, count) => total + count, 0)
    : 0;
  const unreadNotifications = authorization?.permissions.has("notifications.read")
    ? await getDatabase().userNotification.count({ where: { recipientId: authorization.actorId, readAt: null } })
    : 0;
  // Licitações captadas pelo Buscador que ainda aguardam triagem da equipe.
  // Este layout envolve todas as páginas: uma falha aqui derrubaria o sistema
  // inteiro. Como a tabela é recente, a contagem degrada para zero — o aviso
  // deixa de aparecer, e nada mais é afetado.
  const pendingScouted = authorization?.isMaster || authorization?.permissions.has("opportunities.read")
    ? await getDatabase().scoutedTender.count({ where: { status: "PENDING" } }).catch(() => 0)
    : 0;
  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full"><AppShell isMaster={authorization?.isMaster} isOwner={authorization?.isOwner} pendingApprovals={pendingApprovals} pendingScouted={pendingScouted} permissions={permissions} unreadNotifications={unreadNotifications} userLabel={userLabel} signOutAction={signOutAction}>{children}</AppShell></body>
    </html>
  );
}
