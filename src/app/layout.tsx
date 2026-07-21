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
  const pendingApprovals = authorization?.isOwner ? await getDatabase().supportTicket.count({ where: { status: { in: ["WAITING_APPROVAL", "ESCALATED"] } } }) : 0;
  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full"><AppShell isMaster={authorization?.isMaster} isOwner={authorization?.isOwner} pendingApprovals={pendingApprovals} permissions={permissions} userLabel={userLabel} signOutAction={signOutAction}>{children}</AppShell></body>
    </html>
  );
}
