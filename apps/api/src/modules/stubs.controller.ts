import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequireModule } from '@/auth/feature.guard';

/**
 * Should/Could modules scaffolded behind feature flags. Each endpoint is gated by
 * @RequireModule(<M>): when the module is flagged off (the MVP default for
 * M8/M10/M11) the FeatureModuleGuard returns 501 feature_disabled. Enable per env
 * with FEATURE_FLAGS (e.g. "M8") or per tenant. This keeps the boundaries explicit
 * and the surface discoverable without shipping half-built features.
 */
@ApiTags('stubs')
@Controller()
export class StubsController {
  @Get('crm/campaigns')
  @RequireModule('M8') // CRM/marketing — Could
  campaigns() {
    return { items: [], note: 'TODO M8: segmentation + campaigns (SMS/email/push)' };
  }

  @Get('inventory')
  @RequireModule('M10') // Stocks — Could
  inventory() {
    return { items: [], note: 'TODO M10: consumables + reorder' };
  }

  @Get('hr/planning')
  @RequireModule('M11') // RH — Could
  planning() {
    return { items: [], note: 'TODO M11: planning / time-clock' };
  }
}
