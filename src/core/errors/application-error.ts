export type ErrorDetails = Readonly<Record<string, unknown>>;

export class ApplicationError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly details?: ErrorDetails,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class ConfigurationError extends ApplicationError {
  constructor(message: string, details?: ErrorDetails) {
    super(message, "CONFIGURATION_INVALID", 500, details);
  }
}

export class AuthorizationError extends ApplicationError {
  constructor(message = "Acesso negado.", details?: ErrorDetails) {
    super(message, "ACCESS_DENIED", 403, details);
  }
}

export class ValidationError extends ApplicationError {
  constructor(message = "Dados inválidos.", details?: ErrorDetails) {
    super(message, "VALIDATION_ERROR", 400, details);
  }
}

export class ResourceNotFoundError extends ApplicationError {
  constructor(message = "Recurso não encontrado.", details?: ErrorDetails) {
    super(message, "NOT_FOUND", 404, details);
  }
}

export class ConflictError extends ApplicationError {
  constructor(message = "Conflito ao atualizar o recurso.", details?: ErrorDetails) {
    super(message, "CONFLICT", 409, details);
  }
}
