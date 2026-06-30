import { Catch, type ArgumentsHost, type ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { AppError, type ProblemDetails } from '@pilotage/shared';

/**
 * Serializes every error as RFC-7807 problem+json so the web client can branch
 * on a stable `code` without leaking internals. AppError → its mapped status;
 * Nest HttpException → mapped; anything else → 500 internal.
 */
@Catch()
export class ProblemFilter implements ExceptionFilter {
  private readonly logger = new Logger('Problem');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const requestId = res.getHeader('x-request-id')?.toString();
    let problem: ProblemDetails;

    if (exception instanceof AppError) {
      problem = exception.toProblem(requestId);
    } else if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      problem = {
        code: status === 404 ? 'not_found' : status === 403 ? 'forbidden' : status === 401 ? 'unauthenticated' : 'internal',
        status,
        title: typeof body === 'string' ? body : ((body as { message?: string }).message ?? exception.message),
        requestId,
      };
    } else {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
      problem = { code: 'internal', status: 500, title: 'Erreur interne', requestId };
    }

    res.status(problem.status).type('application/problem+json').json(problem);
  }
}
