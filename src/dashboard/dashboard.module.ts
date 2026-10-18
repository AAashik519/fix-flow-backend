import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InventoryItem, InventoryItemSchema } from '../inventory/inventory-item.schema';
import { Payment, PaymentSchema } from '../payments/payment.schema';
import { RepairTicket, RepairTicketSchema } from '../repair-tickets/repair-ticket.schema';
import { User, UserSchema } from '../users/user.schema';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RepairTicket.name, schema: RepairTicketSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: InventoryItem.name, schema: InventoryItemSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
