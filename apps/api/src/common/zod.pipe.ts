import { type PipeTransform, Injectable } from '@nestjs/common';
import type { ZodSchema } from 'zod';
import { AppError } from '@pilotage/shared';

/**
 * Validates input against a Zod schema; on failure throws a typed
 * validation_failed AppError (→ 422 problem+json with per-field errors).
 * Usage: `@Body(new ZodPipe(createTicketInput)) body: CreateTicketInput`.
 */
@Injectable()
export class ZodPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join('.') || '_';
        (fieldErrors[key] ??= []).push(issue.message);
      }
      throw new AppError('validation_failed', 'Données invalides', { fieldErrors });
    }
    return result.data;
  }
}
