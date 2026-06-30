import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { DbModule } from './db/db.module';
import { AuthMiddleware } from './auth/auth.middleware';
import { PermissionGuard } from './auth/rbac';
import { ProblemFilter } from './common/problem.filter';
import { LlmService } from './llm/llm.service';
import { ReadService } from './modules/read.service';
import { AuditService } from './modules/audit.service';
import { HealthController } from './modules/health.controller';
import { CoreController } from './modules/core.controller';
import { ReadController } from './modules/read.controller';

/**
 * Root module. One module would normally exist per domain (M1–M12); for the MVP
 * the read endpoints share a controller and the DB-backed ones another, keeping
 * the boundaries explicit via RBAC permissions and services. AuthMiddleware
 * establishes the tenant-scoped request context for every route except /health.
 */
@Module({
  imports: [DbModule],
  controllers: [HealthController, CoreController, ReadController],
  providers: [
    LlmService,
    ReadService,
    AuditService,
    { provide: APP_FILTER, useClass: ProblemFilter },
    { provide: APP_GUARD, useClass: PermissionGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).exclude('health').forRoutes('*');
  }
}
