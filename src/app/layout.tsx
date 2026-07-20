import type { Metadata } from "next";
import { auth, signOut } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { getCurrentAuthorizationContext } from "@/core/authorization/authorization-context";
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
  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full"><AppShell isMaster={authorization?.isMaster} permissions={permissions} userLabel={userLabel} signOutAction={signOutAction}>{children}</AppShell></body>
    </html>
  );
}
