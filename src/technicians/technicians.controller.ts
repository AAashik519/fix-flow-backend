import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/constants/roles';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { CreateTechnicianDto } from './dto/create-technician.dto';
import { UpdateTechnicianDto } from './dto/update-technician.dto';
import { TechniciansService } from './technicians.service';

@ApiTags('technicians')
@ApiBearerAuth()
@Controller('technicians')
export class TechniciansController {
  constructor(private readonly techniciansService: TechniciansService) {}

  @Roles(UserRole.ADMIN)
  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateTechnicianDto) {
    return { success: true, data: await this.techniciansService.create(user.shopId, dto) };
  }

  @Roles(UserRole.ADMIN)
  @Get()
  async findAll(@CurrentUser() user: AuthUser) {
    return { success: true, data: await this.techniciansService.findAll(user.shopId) };
  }

  @Roles(UserRole.ADMIN)
  @Get(':id')
  async findOne(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string) {
    return { success: true, data: await this.techniciansService.findOne(user.shopId, id) };
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateTechnicianDto,
  ) {
    return { success: true, data: await this.techniciansService.update(user.shopId, id, dto) };
  }

  @Roles(UserRole.ADMIN)
  @Get(':id/assignments')
  async assignments(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string) {
    return { success: true, data: await this.techniciansService.assignments(user.shopId, id) };
  }
}
