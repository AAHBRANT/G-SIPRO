import { getEnvironment } from "@/core/config/env";
import { ConfigurationError } from "@/core/errors/application-error";

export type EntraConfiguration = Readonly<{
  authSecret: string;
  clientId: string;
  clientSecret: string;
  issuer: string;
  tenantId: string;
}>;

export function getEntraConfiguration(): EntraConfiguration {
  const environment = getEnvironment();
  const required = {
    AUTH_SECRET: environment.AUTH_SECRET,
    ENTRA_CLIENT_ID: environment.ENTRA_CLIENT_ID,
    ENTRA_CLIENT_SECRET: environment.ENTRA_CLIENT_SECRET,
    ENTRA_TENANT_ID: environment.ENTRA_TENANT_ID,
  };
  const fields = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([field]) => field);

  if (fields.length > 0) {
    throw new ConfigurationError("Configuração corporativa de identidade incompleta.", { fields });
  }

  const tenantId = environment.ENTRA_TENANT_ID as string;
  return {
    authSecret: environment.AUTH_SECRET as string,
    clientId: environment.ENTRA_CLIENT_ID as string,
    clientSecret: environment.ENTRA_CLIENT_SECRET as string,
    issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
    tenantId,
  };
}
