/**
 * Typed error model. The API serializes these as RFC-7807 problem+json so the
 * web client can branch on `code` without leaking internals.
 */
export type ErrorCode =
  | 'validation_failed'
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'rate_limited'
  | 'tenant_isolation'
  | 'feature_disabled'
  | 'upstream_unavailable'
  | 'internal';

export const ERROR_STATUS: Record<ErrorCode, number> = {
  validation_failed: 422,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
  tenant_isolation: 403,
  feature_disabled: 501,
  upstream_unavailable: 502,
  internal: 500,
};

export interface ProblemDetails {
  /** Stable machine-readable code (also used as the problem `type` suffix). */
  code: ErrorCode;
  /** HTTP status. */
  status: number;
  /** Short, human-readable summary (FR or EN; UI may re-localize by code). */
  title: string;
  /** Optional longer explanation, safe to show the user. */
  detail?: string;
  /** Optional per-field validation messages. */
  errors?: Record<string, string[]>;
  /** Request correlation id, for support. */
  requestId?: string;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly detail?: string;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(
    code: ErrorCode,
    message: string,
    opts: { detail?: string; fieldErrors?: Record<string, string[]> } = {},
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = ERROR_STATUS[code];
    this.detail = opts.detail;
    this.fieldErrors = opts.fieldErrors;
  }

  toProblem(requestId?: string): ProblemDetails {
    return {
      code: this.code,
      status: this.status,
      title: this.message,
      detail: this.detail,
      errors: this.fieldErrors,
      requestId,
    };
  }

  static notFound(entity: string) {
    return new AppError('not_found', `${entity} introuvable`);
  }
  static forbidden(message = 'Action non autorisée') {
    return new AppError('forbidden', message);
  }
  static featureDisabled(module: string) {
    return new AppError('feature_disabled', `Module ${module} non disponible`);
  }
}
