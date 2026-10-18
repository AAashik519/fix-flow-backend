import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/constants/roles';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.TECHNICIAN)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  async overview(@CurrentUser() user: AuthUser) {
    return { success: true, data: await this.dashboardService.overview(user.shopId) };
  }

  @Roles(UserRole.ADMIN)
  @Get('repair-statistics')
  async repairStats(@CurrentUser() user: AuthUser) {
    return { success: true, data: await this.dashboardService.repairStatistics(user.shopId) };
  }

  @Roles(UserRole.ADMIN)
  @Get('revenue-statistics')
  async revenueStats(@CurrentUser() user: AuthUser) {
    return { success: true, data: await this.dashboardService.revenueStatistics(user.shopId) };
  }

  @Roles(UserRole.ADMIN)
  @Get('technician-workload')
  async workload(@CurrentUser() user: AuthUser) {
    return { success: true, data: await this.dashboardService.technicianWorkload(user.shopId) };
  }
}
