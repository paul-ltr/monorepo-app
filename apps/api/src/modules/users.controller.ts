import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  inviteUserInput,
  updateUserRolesInput,
  type AppUser,
  type RequestContext,
} from '@pilotage/shared';
import { Ctx, RequirePermission } from '@/auth/rbac';
import { UsersService } from './users.service';

/**
 * Tenant-facing user management (M12). Restricted to super admins (owner) and
 * network admins via `M12:users:manage`; scope escalation is guarded in the
 * service. Not to be confused with the superuser back-office `ConsoleController`.
 */
@ApiTags('users')
@Controller('users')
@RequirePermission('M12:users:manage')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(): Promise<AppUser[]> {
    return this.users.list();
  }

  @Post('invite')
  invite(@Ctx() ctx: RequestContext, @Body() body: unknown): Promise<AppUser> {
    return this.users.invite(ctx, inviteUserInput.parse(body));
  }

  @Patch(':id/roles')
  updateRoles(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() body: unknown): Promise<AppUser> {
    return this.users.updateRoles(ctx, updateUserRolesInput.parse({ ...(body as object), userId: id }));
  }

  @Post(':id/disable')
  disable(@Ctx() ctx: RequestContext, @Param('id') id: string): Promise<AppUser> {
    return this.users.disable(ctx, id);
  }
}
