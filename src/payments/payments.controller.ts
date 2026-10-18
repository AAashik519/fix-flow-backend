import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/constants/roles';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { QueryPaymentsDto } from './dto/query-payments.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@ApiBearerAuth()
@Controller()
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Roles(UserRole.ADMIN)
  @Post('payments')
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreatePaymentDto) {
    return {
      success: true,
      data: await this.paymentsService.create(user.shopId, user.userId, dto),
    };
  }

  @Roles(UserRole.ADMIN)
  @Get('payments')
  async findAll(@CurrentUser() user: AuthUser, @Query() query: QueryPaymentsDto) {
    const { items, meta } = await this.paymentsService.findAll(user.shopId, query);
    return { success: true, data: items, meta };
  }

  @Roles(UserRole.ADMIN)
  @Get('payments/:id')
  async findOne(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string) {
    return { success: true, data: await this.paymentsService.findOne(user.shopId, id) };
  }

  @Roles(UserRole.ADMIN)
  @Get('repair-tickets/:id/payments')
  async forTicket(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string) {
    return { success: true, data: await this.paymentsService.forTicket(user.shopId, id) };
  }

  @Roles(UserRole.ADMIN)
  @Post('payments/:id/refunds')
  async refund(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: RefundPaymentDto,
  ) {
    return {
      success: true,
      data: await this.paymentsService.refund(user.shopId, user.userId, id, dto),
    };
  }
}
