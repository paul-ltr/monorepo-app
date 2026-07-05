import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { DbModule } from './db/db.module';
import { AuthMiddleware } from './auth/auth.middleware';
import { PermissionGuard } from './auth/rbac';
import { FeatureModuleGuard } from './auth/feature.guard';
import { ProblemFilter } from './common/problem.filter';
import { LlmService } from './llm/llm.service';
import { ReadService } from './modules/read.service';
import { AuditService } from './modules/audit.service';
import { HealthController } from './modules/health.controller';
import { CoreController } from './modules/core.controller';
import { ReadController } from './modules/read.controller';
import { ActionsController } from './modules/actions.controller';
import { StubsController } from './modules/stubs.controller';
import { SupportController, ConsoleController } from './modules/console.controller';
import { ConsoleService } from './modules/console.service';
import { UsersController } from './modules/users.controller';
import { UsersService } from './modules/users.service';
import { CognitoAdminService } from './modules/cognito-admin.service';
import { LeadsController } from './modules/leads.controller';
import { ConnectorsController } from './modules/connectors.controller';
import { MailerService } from './modules/mailer.service';
import { ConnectorStore } from './modules/connector-store.service';
import { ElectroluxService } from './modules/electrolux.service';
import { MieleService } from './modules/miele.service';
import { SecretStore } from './modules/secret-store.service';
import { EnedisService } from './modules/enedis.service';
import { PennylaneService } from './modules/pennylane.service';
import { GrdfService } from './modules/grdf.service';

/**
 * Root module. One module would normally exist per domain (M1–M12); for the MVP
 * the read endpoints share a controller and the DB-backed ones another, keeping
 * the boundaries explicit via RBAC permissions and services. AuthMiddleware
 * establishes the tenant-scoped request context for every route except /health.
 */
@Module({
  imports: [DbModule],
  controllers: [
    HealthController,
    CoreController,
    ReadController,
    ActionsController,
    StubsController,
    SupportController,
    ConsoleController,
    LeadsController,
    ConnectorsController,
    UsersController,
  ],
  providers: [
    LlmService,
    ReadService,
    AuditService,
    ConsoleService,
    UsersService,
    CognitoAdminService,
    MailerService,
    ConnectorStore,
    SecretStore,
    ElectroluxService,
    MieleService,
    EnedisService,
    GrdfService,
    PennylaneService,
    { provide: APP_FILTER, useClass: ProblemFilter },
    { provide: APP_GUARD, useClass: FeatureModuleGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthMiddleware)
      .exclude(
        'health',
        'public/leads',
        'connectors/enedis/callback',
        'connectors/pennylane/callback',
        'connectors/miele/callback',
      )
      .forRoutes('*');
  }
}
