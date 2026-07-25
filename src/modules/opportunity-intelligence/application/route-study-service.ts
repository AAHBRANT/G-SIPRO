import { createHash, randomUUID } from "node:crypto";

import type { RouteApi, RouteDetail } from "./route-api";
import {
  routeBaseSchema,
  routeDestinationSchema,
  type RouteBase,
  type RouteDestination,
  type RouteMatrixResponse,
} from "../domain/route-study";

export interface RouteStudyRepository {
  listActiveRouteBases(): Promise<RouteBase[]>;
  recordRouteStudy(
    opportunityId: string,
    destination: RouteDestination,
    bases: RouteBase[],
    response: RouteMatrixResponse,
    selectedBaseId: string,
    actorId: string,
    correlationId: string,
  ): Promise<unknown>;
  findRouteStudy(analysisId: string): Promise<unknown | null>;
  findRouteDetailContext(analysisId: string, baseId: string): Promise<{
    routeStudyId: string;
    destination: RouteDestination;
    base: RouteBase;
  } | null>;
  recordRouteDetail(
    routeStudyId: string,
    detail: RouteDetail,
    responseHash: string,
    actorId: string,
    correlationId: string,
  ): Promise<unknown>;
}

export class RouteStudyRuleError extends Error {}

export class RouteStudyService {
  constructor(
    private readonly repository: RouteStudyRepository,
    private readonly routeApi?: RouteApi,
  ) {}

  async run(
    opportunityId: string,
    destinationInput: unknown,
    selectedBaseId: string,
    actorId: string,
    correlationId: string = randomUUID(),
  ) {
    if (!this.routeApi) throw new Error("API de rotas obrigatória para executar a consulta.");
    const destination = routeDestinationSchema.parse(destinationInput);
    const activeBases = routeBaseSchema.array().parse(await this.repository.listActiveRouteBases());
    if (activeBases.length === 0) {
      throw new RouteStudyRuleError("Cadastre ao menos uma base operacional ativa.");
    }
    const selectedBase = activeBases.find(base => base.id === selectedBaseId);
    if (!selectedBase) {
      throw new RouteStudyRuleError("Selecione uma base operacional ativa para o endereço de partida.");
    }
    const bases = [selectedBase];
    const response = await this.routeApi.computeMatrix(bases, destination);
    return this.repository.recordRouteStudy(
      opportunityId,
      destination,
      bases,
      response,
      selectedBase.id,
      actorId,
      correlationId,
    );
  }

  find(analysisId: string) {
    return this.repository.findRouteStudy(analysisId);
  }

  async loadMapRoute(
    analysisId: string,
    baseId: string,
    actorId: string,
    correlationId: string = randomUUID(),
  ) {
    if (!this.routeApi) throw new Error("API de rotas obrigatória para carregar o mapa.");
    const context = await this.repository.findRouteDetailContext(analysisId, baseId);
    if (!context) throw new RouteStudyRuleError("Estudo de rota ou base operacional não encontrado.");
    const detail = await this.routeApi.computeRoute(context.base, context.destination);
    const responseHash = createHash("sha256").update(JSON.stringify(detail)).digest("hex");
    return this.repository.recordRouteDetail(
      context.routeStudyId,
      detail,
      responseHash,
      actorId,
      correlationId,
    );
  }
}
