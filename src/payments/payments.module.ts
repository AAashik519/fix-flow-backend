import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationsModule } from '../notifications/notifications.module';
import {
  RepairTicket,
  RepairTicketSchema,
} from '../repair-tickets/repair-ticket.schema';
import { RepairTicketsModule } from '../repair-tickets/repair-tickets.module';
import { User, UserSchema } from '../users/user.schema';
import { Payment, PaymentSchema } from './payment.schema';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [
    RepairTicketsModule,
    NotificationsModule,
    MongooseModule.forFeature([
      { name: Payment.name, schema: PaymentSchema },
      { name: RepairTicket.name, schema: RepairTicketSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
