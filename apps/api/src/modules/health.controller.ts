import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { sql } from 'drizzle-orm';
import type { Database } from '@pilotage/db';
import { DATABASE } from '@/db/db.module';

/** Liveness/readiness — unauthenticated (excluded from AuthMiddleware). */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  @Get()
  async health() {
    let database = 'ok';
    try {
      await this.db.execute(sql`select 1`);
    } catch {
      database = 'down';
    }
    return { status: database === 'ok' ? 'ok' : 'degraded', database, time: new Date().toISOString() };
  }
}
