export type IntelligenceIntegrationCode =
  | "CLIMATE"
  | "GOOGLE_ROUTES"
  | "GOOGLE_GEOCODING"
  | "GOOGLE_MAPS"
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
      code: "GOOGLE_GEOCODING" as const,
      label: "Busca de cidade/endereço",
      required: ["GOOGLE_GEOCODING_API_KEY"],
      nextAction: "Criar uma chave de servidor restrita à Geocoding API para converter cidade ou endereço em coordenadas.",
      responsible: "ADMINISTRADOR_CLOUD" as const,
    },
    {
      code: "GOOGLE_ROUTES" as const,
      label: "Google Routes",
      required: ["GOOGLE_ROUTES_API_KEY"],
      nextAction: "Criar uma chave de servidor restrita à Routes API, com quota e alerta de custo.",
      responsible: "ADMINISTRADOR_CLOUD" as const,
    },
    {
      code: "GOOGLE_MAPS" as const,
      label: "Mapa incorporado",
      required: ["NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY"],
      nextAction: "Criar uma chave de navegador separada, restrita ao domínio HML e à Maps Embed API.",
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
