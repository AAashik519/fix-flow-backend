import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Customer, CustomerSchema } from '../customers/customer.schema';
import { Device, DeviceSchema } from '../devices/device.schema';
import { TicketCounter, TicketCounterSchema } from '../database/ticket-counter.schema';
import { InventoryItem, InventoryItemSchema } from '../inventory/inventory-item.schema';
import { StockMovement, StockMovementSchema } from '../inventory/stock-movement.schema';
import { MailModule } from '../mail/mail.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { Shop, ShopSchema } from '../shops/shop.schema';
import { User, UserSchema } from '../users/user.schema';
import { RepairTicket, RepairTicketSchema } from './repair-ticket.schema';
import { RepairTicketsController } from './repair-tickets.controller';
import { RepairTicketsService } from './repair-tickets.service';
import { StatusTransitionService } from './status-transition.service';

@Module({
  imports: [
    NotificationsModule,
    MailModule,
    MongooseModule.forFeature([
      { name: RepairTicket.name, schema: RepairTicketSchema },
      { name: Customer.name, schema: CustomerSchema },
      { name: Device.name, schema: DeviceSchema },
      { name: User.name, schema: UserSchema },
      { name: Shop.name, schema: ShopSchema },
      { name: InventoryItem.name, schema: InventoryItemSchema },
      { name: StockMovement.name, schema: StockMovementSchema },
      { name: TicketCounter.name, schema: TicketCounterSchema },
    ]),
  ],
  controllers: [RepairTicketsController],
  providers: [RepairTicketsService, StatusTransitionService],
  exports: [RepairTicketsService, MongooseModule],
})
export class RepairTicketsModule {}
