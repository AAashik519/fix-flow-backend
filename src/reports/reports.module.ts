import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InventoryItem, InventoryItemSchema } from '../inventory/inventory-item.schema';
import { StockMovement, StockMovementSchema } from '../inventory/stock-movement.schema';
import { Payment, PaymentSchema } from '../payments/payment.schema';
import { RepairTicket, RepairTicketSchema } from '../repair-tickets/repair-ticket.schema';
import { User, UserSchema } from '../users/user.schema';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RepairTicket.name, schema: RepairTicketSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: InventoryItem.name, schema: InventoryItemSchema },
      { name: StockMovement.name, schema: StockMovementSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
