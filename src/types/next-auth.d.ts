import "next-auth";
import "next-auth/jwt";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    entraObjectId?: string;
    tenantId?: string;
  }

  interface Session {
    user: {
      entraObjectId?: string;
      tenantId?: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    entraObjectId?: string;
    tenantId?: string;
  }
}
