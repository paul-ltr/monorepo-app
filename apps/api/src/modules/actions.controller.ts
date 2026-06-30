import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { eq } from 'drizzle-orm';
import { schema } from '@pilotage/db';
import { AppError, deviceCommandRequest, type DeviceCommandRequest, type RequestContext } from '@pilotage/shared';
import { ScopedDb } from '@/db/db.module';
import { AuditService } from './audit.service';
import { RequirePermission, Ctx } from '@/auth/rbac';
import { ZodPipe } from '@/common/zod.pipe';

/**
 * M1 (Should) — remote actions. The app NEVER talks to device/payment provider
 * APIs directly: it writes a row to core.device_command (RLS-scoped) that the
 * data repo consumes and executes, writing status back. This is the cross-repo
 * command contract (ARCHITECTURE.md §2).
 */
@ApiTags('actions')
@Controller('machines')
export class ActionsController {
  constructor(
    private readonly db: ScopedDb,
    private readonly audit: AuditService,
  ) {}

  @Post(':id/command')
  @RequirePermission('M1:machines:command')
  async command(
    @Param('id') machineId: string,
    @Body(new ZodPipe(deviceCommandRequest)) body: DeviceCommandRequest,
    @Ctx() ctx: RequestContext,
  ) {
    const cmd = await this.db.run(async (tx) => {
      const machine = (
        await tx.select().from(schema.machine).where(eq(schema.machine.id, machineId)).limit(1)
      )[0];
      if (!machine) throw AppError.notFound('Machine');

      return (
        await tx
          .insert(schema.deviceCommand)
          .values({
            tenantId: ctx.tenantId,
            siteId: machine.siteId,
            machineId,
            type: body.type,
            payload: body.payload ?? null,
            status: 'queued',
            requestedBy: ctx.userId,
          })
          .returning()
      )[0];
    });

    await this.audit.record(ctx, `device_command.${body.type}`, 'device_command', cmd!.id);
    return cmd;
  }
}
