import { Body, Controller, Inject, Param, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { type Database } from '@pilotage/db';
import { AppError } from '@pilotage/shared';
import { DATABASE } from '@/db/db.module';
import { loadEnv } from '@/config/env';

const claimInput = z.object({ limit: z.number().int().min(1).max(200).default(25) });
// The data repo only ever acks with a terminal status (see its device_commands.py).
const ackInput = z.object({ status: z.enum(['acked', 'failed']) });

interface ClaimedCommand {
  id: string;
  tenant_id: string;
  site_id: string;
  machine_id: string;
  type: string;
  payload: unknown;
}

/**
 * VPC-internal endpoints the data repo's device-command worker calls (its
 * default `internal_api` mode). This is the app side of the cross-repo command
 * contract: the worker claims queued `core.device_command` rows, executes them
 * against providers, and acks status back — WITHOUT the data repo ever touching
 * `core` directly. Excluded from the tenant AuthMiddleware (see app.module) and
 * guarded by a shared token instead; the underlying SQL functions are
 * SECURITY DEFINER so they drain across tenants (see packages/db/sql/rls.sql).
 */
@ApiTags('internal')
@Controller('internal/device-commands')
export class InternalController {
  private readonly env = loadEnv();

  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /** Constant-time shared-secret check. Fails closed outside local dev. */
  private authorize(req: Request): void {
    const expected = this.env.INTERNAL_API_TOKEN;
    if (!expected) {
      if (this.env.NODE_ENV === 'production') {
        throw new AppError('internal', 'internal_api_unconfigured');
      }
      return; // dev convenience when no token is provisioned
    }
    const got = req.header('x-internal-token') ?? '';
    const a = Buffer.from(got);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new AppError('unauthenticated', 'internal_unauthorized');
    }
  }

  @Post('claim')
  async claim(@Req() req: Request, @Body() body: unknown): Promise<{ commands: ClaimedCommand[] }> {
    this.authorize(req);
    const { limit } = claimInput.parse(body ?? {});
    const res = await this.db.execute(sql`select * from core.claim_device_commands(${limit})`);
    const rows = (res as unknown as { rows: ClaimedCommand[] }).rows ?? [];
    return { commands: rows };
  }

  @Post(':id/ack')
  async ack(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<{ ok: true }> {
    this.authorize(req);
    const { status } = ackInput.parse(body);
    await this.db.execute(sql`select core.ack_device_command(${id}::uuid, ${status})`);
    return { ok: true };
  }
}
