import { Injectable } from '@nestjs/common';
import { schema } from '@pilotage/db';
import type { RequestContext } from '@pilotage/shared';
import { ScopedDb } from '@/db/db.module';

/** Writes mutations to core.audit_log (tenant-scoped via RLS). */
@Injectable()
export class AuditService {
  constructor(private readonly db: ScopedDb) {}

  async record(ctx: RequestContext, action: string, entityType: string, entityId: string): Promise<void> {
    await this.db.run(async (tx) => {
      await tx.insert(schema.auditLog).values({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action,
        entityType,
        entityId,
      });
    });
  }
}
