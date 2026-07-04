import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { generateOperatInput, period as periodSchema, type Period } from '@pilotage/shared';
import { ReadService } from './read.service';
import { AuditService } from './audit.service';
import { RequirePermission, Ctx } from '@/auth/rbac';
import { ZodPipe } from '@/common/zod.pipe';
import type { RequestContext } from '@pilotage/shared';

/** Dashboards & analytics-derived reads (M1/M2/M5/M9). RBAC-guarded. */
@ApiTags('read')
@Controller()
export class ReadController {
  constructor(
    private readonly read: ReadService,
    private readonly audit: AuditService,
  ) {}

  private period(raw?: string): Period {
    return periodSchema.catch('today').parse(raw);
  }

  @Get('dashboard')
  @RequirePermission('M1:dashboard:view')
  dashboard(@Query('period') period?: string) {
    return this.read.getDashboard(this.period(period));
  }

  @Get('machines/status')
  @RequirePermission('M1:machines:view')
  machineStatuses() {
    return this.read.getMachineStatuses();
  }

  @Get('machines/:id')
  @RequirePermission('M1:machines:view')
  machineDetail(@Param('id') id: string) {
    return this.read.getMachineDetail(id);
  }

  @Get('revenue')
  @RequirePermission('M2:revenue:view')
  revenue(@Query('period') period?: string) {
    return this.read.getRevenue(this.period(period));
  }

  @Get('energy')
  @RequirePermission('M5:energy:view')
  energy(@Ctx() ctx: RequestContext) {
    return this.read.getEnergy(ctx.tenantId);
  }

  @Post('energy/operat')
  @RequirePermission('M5:operat:generate')
  async generateOperat(
    @Body(new ZodPipe(generateOperatInput)) body: { year: number },
    @Ctx() ctx: RequestContext,
  ) {
    const report = this.read.generateOperat(body.year);
    await this.audit.record(ctx, 'operat.generate', 'operat_report', report.id);
    return report;
  }

  @Get('maintenance')
  @RequirePermission('M4:maintenance:view')
  maintenance() {
    return this.read.getMaintenance();
  }

  @Get('pricing')
  @RequirePermission('M7:pricing:view')
  pricing() {
    return this.read.getPricing();
  }

  @Get('customers')
  @RequirePermission('M3:customers:view')
  customers() {
    return this.read.getCustomers();
  }

  @Get('finance')
  @RequirePermission('M6:finance:view')
  finance() {
    return this.read.getFinance();
  }

  @Get('network')
  @RequirePermission('M9:network:view')
  network() {
    return this.read.getNetwork();
  }

  @Get('admin')
  @RequirePermission('M12:connectors:manage')
  admin() {
    return this.read.getAdmin();
  }

  @Get('notifications')
  @RequirePermission('M1:dashboard:view')
  notifications() {
    return this.read.getNotifications();
  }
}
