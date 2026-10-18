import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/constants/roles';
import { QueryReportsDto } from './dto/query-reports.dto';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('repairs')
  async repairs(@CurrentUser() user: AuthUser, @Query() query: QueryReportsDto) {
    return { success: true, data: await this.reportsService.repairs(user.shopId, query) };
  }

  @Get('payments')
  async payments(@CurrentUser() user: AuthUser, @Query() query: QueryReportsDto) {
    return { success: true, data: await this.reportsService.payments(user.shopId, query) };
  }

  @Get('inventory')
  async inventory(@CurrentUser() user: AuthUser) {
    return { success: true, data: await this.reportsService.inventory(user.shopId) };
  }

  @Get('technicians')
  async technicians(@CurrentUser() user: AuthUser, @Query() query: QueryReportsDto) {
    return {
      success: true,
      data: await this.reportsService.technicianPerformance(user.shopId, query),
    };
  }

  @Get('export')
  async export(
    @CurrentUser() user: AuthUser,
    @Query() query: QueryReportsDto,
    @Res() res: Response,
  ) {
    const { csv, filename } = await this.reportsService.export(user.shopId, query);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }
}
