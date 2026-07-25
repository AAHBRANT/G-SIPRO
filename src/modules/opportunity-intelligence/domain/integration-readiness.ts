export type IntelligenceIntegrationCode =
  | "CLIMATE"
  | "AZURE_MAPS"
  | "TEAMS_ACTIVITY"
  | "EMAIL";

export type IntelligenceIntegrationReadiness = Readonly<{
  code: IntelligenceIntegrationCode;
  label: string;
  status: "READY" | "OWNER_ACTION_REQUIRED";
  missingConfiguration: readonly string[];
  nextAction: string;
  responsible: "PROPRIETARIO" | "ADMINISTRADOR_CLOUD";
}>;

type EnvironmentLike = Readonly<Record<string, string | undefined>>;

const configured = (value: string | undefined) => Boolean(value?.trim());

export function evaluateIntelligenceIntegrationReadiness(
  environment: EnvironmentLike,
): readonly IntelligenceIntegrationReadiness[] {
  const definitions = [
    {
      code: "CLIMATE" as const,
      label: "Dados climáticos",
      required: ["CLIMATE_API_BASE_URL"],
      nextAction: "Contratar ou aprovar o provedor climático e registrar a URL da API no Azure.",
      responsible: "PROPRIETARIO" as const,
    },
    {
      code: "AZURE_MAPS" as const,
      label: "Localização, rotas e mapas",
      required: ["AZURE_MAPS_CLIENT_ID"],
      nextAction: "Criar a conta Azure Maps e conceder à identidade gerenciada do G-SIPRO acesso somente de leitura.",
      responsible: "ADMINISTRADOR_CLOUD" as const,
    },
    {
      code: "TEAMS_ACTIVITY" as const,
      label: "Notificações no Teams",
      required: ["ENTRA_TENANT_ID", "ENTRA_CLIENT_ID", "ENTRA_CLIENT_SECRET", "TEAMS_CATALOG_APP_ID"],
      nextAction: "Validar consentimento TeamsActivity.Send.User e publicar a versão atualizada do aplicativo.",
      responsible: "PROPRIETARIO" as const,
    },
    {
      code: "EMAIL" as const,
      label: "Notificações por e-mail",
      required: ["ENTRA_TENANT_ID", "ENTRA_CLIENT_ID", "ENTRA_CLIENT_SECRET", "NOTIFICATION_EMAIL_SENDER"],
      nextAction: "Autorizar Mail.Send para a identidade de serviço e definir o remetente corporativo.",
      responsible: "PROPRIETARIO" as const,
    },
  ];

  return definitions.map((definition) => {
    const missingConfiguration = definition.required.filter(
      (key) => !configured(environment[key]),
    );
    return {
      code: definition.code,
      label: definition.label,
      status: missingConfiguration.length === 0
        ? "READY" as const
        : "OWNER_ACTION_REQUIRED" as const,
      missingConfiguration,
      nextAction: missingConfiguration.length === 0
        ? "Configuração presente. Executar teste controlado no ambiente de homologação."
        : definition.nextAction,
      responsible: definition.responsible,
    };
  });
}
