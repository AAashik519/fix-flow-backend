import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/constants/roles';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { QueryCustomersDto } from './dto/query-customers.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@ApiTags('customers')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.TECHNICIAN)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Roles(UserRole.ADMIN)
  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateCustomerDto) {
    const data = await this.customersService.create(user.shopId, dto);
    return { success: true, data };
  }

  @Get()
  async findAll(@CurrentUser() user: AuthUser, @Query() query: QueryCustomersDto) {
    const { items, meta } = await this.customersService.findAll(user.shopId, query);
    return { success: true, data: items, meta };
  }

  @Get(':id')
  async findOne(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string) {
    const data = await this.customersService.findOne(user.shopId, id);
    return { success: true, data };
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    const data = await this.customersService.update(user.shopId, id, dto);
    return { success: true, data };
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string) {
    const data = await this.customersService.remove(user.shopId, id);
    return { success: true, data };
  }

  @Get(':id/repair-history')
  async history(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string) {
    const data = await this.customersService.repairHistory(user.shopId, id);
    return { success: true, data };
  }
}
