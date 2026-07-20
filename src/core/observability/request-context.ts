import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { z } from "zod";

export type RequestContext = Readonly<{
  correlationId: string;
  actorId?: string;
}>;

const storage = new AsyncLocalStorage<RequestContext>();

export function createRequestContext(input?: Partial<RequestContext>): RequestContext {
  const correlationId = z.uuid().safeParse(input?.correlationId);
  return Object.freeze({
    correlationId: correlationId.success ? correlationId.data : randomUUID(),
    actorId: input?.actorId,
  });
}

export function runWithRequestContext<T>(context: RequestContext, operation: () => T): T {
  return storage.run(context, operation);
}

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}
