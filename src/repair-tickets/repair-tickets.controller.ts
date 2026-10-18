import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/constants/roles';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { AddNoteDto } from './dto/add-note.dto';
import { AddPartsDto } from './dto/add-parts.dto';
import { AssignTechnicianDto } from './dto/assign-technician.dto';
import { CreateRepairTicketDto } from './dto/create-repair-ticket.dto';
import { DiagnosticsDto } from './dto/diagnostics.dto';
import { QueryRepairTicketsDto } from './dto/query-repair-tickets.dto';
import { UpdateRepairStatusDto } from './dto/update-repair-status.dto';
import { UpdateRepairTicketDto } from './dto/update-repair-ticket.dto';
import { RepairTicketsService } from './repair-tickets.service';

@ApiTags('repair-tickets')
@Controller()
export class RepairTicketsController {
  constructor(private readonly repairTicketsService: RepairTicketsService) {}

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Post('repair-tickets')
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateRepairTicketDto) {
    return { success: true, data: await this.repairTicketsService.create(user, dto) };
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.TECHNICIAN)
  @Get('repair-tickets')
  async findAll(@CurrentUser() user: AuthUser, @Query() query: QueryRepairTicketsDto) {
    const { items, meta } = await this.repairTicketsService.findAll(user, query);
    return { success: true, data: items, meta };
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.TECHNICIAN)
  @Get('repair-tickets/:id')
  async findOne(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string) {
    return { success: true, data: await this.repairTicketsService.findOne(user, id) };
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Patch('repair-tickets/:id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateRepairTicketDto,
  ) {
    return { success: true, data: await this.repairTicketsService.update(user, id, dto) };
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Patch('repair-tickets/:id/assign-technician')
  async assign(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: AssignTechnicianDto,
  ) {
    return { success: true, data: await this.repairTicketsService.assignTechnician(user, id, dto) };
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.TECHNICIAN)
  @Patch('repair-tickets/:id/status')
  async status(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateRepairStatusDto,
  ) {
    return { success: true, data: await this.repairTicketsService.updateStatus(user, id, dto) };
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.TECHNICIAN)
  @Post('repair-tickets/:id/diagnostics')
  async diagnostics(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: DiagnosticsDto,
  ) {
    return { success: true, data: await this.repairTicketsService.addDiagnostics(user, id, dto) };
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.TECHNICIAN)
  @Post('repair-tickets/:id/notes')
  async notes(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: AddNoteDto,
  ) {
    return { success: true, data: await this.repairTicketsService.addNote(user, id, dto) };
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.TECHNICIAN)
  @Post('repair-tickets/:id/parts')
  async parts(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: AddPartsDto,
  ) {
    return { success: true, data: await this.repairTicketsService.addParts(user, id, dto) };
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.TECHNICIAN)
  @Get('repair-tickets/:id/history')
  async history(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string) {
    return { success: true, data: await this.repairTicketsService.history(user, id) };
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Post('repair-tickets/:id/reopen')
  async reopen(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateRepairStatusDto,
  ) {
    return { success: true, data: await this.repairTicketsService.reopen(user, id, dto) };
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Get('public/tracking/:trackingToken')
  async tracking(@Param('trackingToken') trackingToken: string) {
    return {
      success: true,
      data: await this.repairTicketsService.publicTracking(trackingToken),
    };
  }
}
