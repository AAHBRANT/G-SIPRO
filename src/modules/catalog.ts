export const moduleCatalog = [
  { id: "identity", name: "Identidade e Administração", purpose: "Usuários, perfis, departamentos, alçadas e configurações.", dependencies: ["audit"] },
  { id: "opportunities", name: "Oportunidades", purpose: "Entrada e qualificação do pipeline comercial.", dependencies: ["documents", "workflow", "audit"] },
  { id: "scouting", name: "Buscador G-SIPRO", purpose: "Captação automática de licitações de obra em fonte pública e fila de triagem que alimenta as oportunidades.", dependencies: ["opportunities", "identity", "audit"] },
  { id: "opportunity-intelligence", name: "Modo Analítico Inteligente", purpose: "Análises comerciais, técnicas e de praticabilidade para apoiar decisões sobre oportunidades.", dependencies: ["opportunities", "proposals", "tenders", "technical-collection", "compliance-matrix", "analytics", "ai", "workflow", "identity", "audit"] },
  { id: "tenders", name: "Editais e Requisitos", purpose: "Editais, prazos, requisitos, riscos e evidências.", dependencies: ["documents", "ai", "workflow", "technical-collection", "audit"] },
  { id: "technical-collection", name: "Acervo Técnico", purpose: "Atestados, CATs, ARTs, contratos, obras e profissionais.", dependencies: ["documents", "audit"] },
  { id: "compliance-matrix", name: "Matriz de Atendimento", purpose: "Relação entre requisitos e evidências do acervo.", dependencies: ["tenders", "technical-collection", "ai", "workflow", "audit"] },
  { id: "proposals", name: "Propostas", purpose: "Componentes técnico e comercial, versões e envio.", dependencies: ["opportunities", "compliance-matrix", "documents", "workflow", "audit"] },
  { id: "workflow", name: "Workflow e Aprovações", purpose: "Tarefas, estados, prazos, alçadas e decisões.", dependencies: ["identity", "audit"] },
  { id: "competition", name: "Concorrentes e Resultados", purpose: "Participantes, ofertas, julgamentos e resultados.", dependencies: ["proposals", "documents", "audit"] },
  { id: "ai", name: "Inteligência Artificial", purpose: "Casos de uso, fontes, evidências e avaliações.", dependencies: ["documents", "audit"] },
  { id: "analytics", name: "Indicadores e BI", purpose: "Contratos analíticos e indicadores conciliados.", dependencies: ["audit"] },
  { id: "documents", name: "Documentos", purpose: "Metadados, versões, evidências e armazenamento abstrato.", dependencies: ["identity", "audit"] },
  { id: "audit", name: "Auditoria", purpose: "Eventos imutáveis de ações, decisões, integrações e IA.", dependencies: [] },
] as const;

export type ModuleId = (typeof moduleCatalog)[number]["id"];
