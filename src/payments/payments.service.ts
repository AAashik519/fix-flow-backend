import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { toObjectId } from '../common/utils/object-id.util';
import { PaymentRecordStatus } from '../common/constants/payment';
import { UserRole } from '../common/constants/roles';
import { roundMoney } from '../common/utils/money.util';
import { NotificationType } from '../notifications/notification.schema';
import { NotificationsService } from '../notifications/notifications.service';
import {
  RepairTicket,
  RepairTicketDocument,
} from '../repair-tickets/repair-ticket.schema';
import { RepairTicketsService } from '../repair-tickets/repair-tickets.service';
import { User, UserDocument } from '../users/user.schema';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { QueryPaymentsDto } from './dto/query-payments.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { Payment, PaymentDocument } from './payment.schema';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(RepairTicket.name) private ticketModel: Model<RepairTicketDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private repairTicketsService: RepairTicketsService,
    private notifications: NotificationsService,
  ) {}

  async create(shopId: string, userId: string, dto: CreatePaymentDto) {
    const existing = await this.paymentModel.findOne({
      shopId: toObjectId(shopId),
      idempotencyKey: dto.idempotencyKey,
    });
    if (existing) return existing.toObject();

    const ticket = await this.ticketModel.findOne({
      _id: toObjectId(dto.repairTicketId),
      shopId: toObjectId(shopId),
    });
    if (!ticket) throw new NotFoundException('Repair ticket not found');

    const amount = roundMoney(dto.amount);
    if (amount > ticket.outstandingBalance + 0.001) {
      throw new BadRequestException('Payment exceeds outstanding balance');
    }

    try {
      const payment = await this.paymentModel.create({
        shopId: new Types.ObjectId(shopId),
        repairTicketId: new Types.ObjectId(dto.repairTicketId),
        amount,
        method: dto.method,
        status: PaymentRecordStatus.SUCCESS,
        transactionReference: dto.transactionReference,
        recordedBy: new Types.ObjectId(userId),
        idempotencyKey: dto.idempotencyKey,
        note: dto.note,
      });

      await this.repairTicketsService.applyPaymentTotals(shopId, dto.repairTicketId, amount);

      const admins = await this.userModel
        .find({ shopId: toObjectId(shopId), role: UserRole.ADMIN, isActive: true })
        .select('_id')
        .lean();
      await this.notifications.notifyShopAdmins(
        shopId,
        admins.map((a) => String(a._id)),
        {
          type: NotificationType.PAYMENT_RECORDED,
          title: 'Payment recorded',
          message: `Payment of ${amount} recorded for ${ticket.ticketNumber}`,
          relatedTicketId: dto.repairTicketId,
        },
      );

      return payment.toObject();
    } catch (err: unknown) {
      if ((err as { code?: number }).code === 11000) {
        const dup = await this.paymentModel.findOne({
          shopId: toObjectId(shopId),
          idempotencyKey: dto.idempotencyKey,
        });
        if (dup) return dup.toObject();
      }
      throw err;
    }
  }

  async findAll(shopId: string, query: QueryPaymentsDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const filter: Record<string, unknown> = { shopId: new Types.ObjectId(shopId) };
    if (query.repairTicketId) {
      filter.repairTicketId = new Types.ObjectId(query.repairTicketId);
    }
    if (query.from || query.to) {
      filter.createdAt = {};
      if (query.from) (filter.createdAt as Record<string, Date>).$gte = new Date(query.from);
      if (query.to) (filter.createdAt as Record<string, Date>).$lte = new Date(query.to);
    }
    const [items, total] = await Promise.all([
      this.paymentModel
        .find(filter)
        .populate('repairTicketId', 'ticketNumber')
        .populate('recordedBy', 'name')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.paymentModel.countDocuments(filter),
    ]);
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(shopId: string, id: string) {
    const payment = await this.paymentModel
      .findOne({ _id: toObjectId(id), shopId: toObjectId(shopId) })
      .populate('repairTicketId', 'ticketNumber total outstandingBalance paymentStatus')
      .lean();
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }

  async forTicket(shopId: string, ticketId: string) {
    return this.paymentModel
      .find({ shopId: toObjectId(shopId), repairTicketId: toObjectId(ticketId) })
      .sort({ createdAt: -1 })
      .lean();
  }

  async refund(shopId: string, userId: string, id: string, dto: RefundPaymentDto) {
    const existing = await this.paymentModel.findOne({
      shopId: toObjectId(shopId),
      idempotencyKey: dto.idempotencyKey,
    });
    if (existing) return existing.toObject();

    const payment = await this.paymentModel.findOne({ _id: toObjectId(id), shopId: toObjectId(shopId) });
    if (!payment) throw new NotFoundException('Payment not found');

    const amount = roundMoney(dto.amount);
    const available = roundMoney(payment.amount - payment.refundedAmount);
    if (amount > available + 0.001) {
      throw new BadRequestException('Refund exceeds available amount');
    }

    payment.refundedAmount = roundMoney(payment.refundedAmount + amount);
    payment.status =
      payment.refundedAmount + 0.001 >= payment.amount
        ? PaymentRecordStatus.REFUNDED
        : PaymentRecordStatus.PARTIALLY_REFUNDED;
    await payment.save();

    await this.repairTicketsService.applyPaymentTotals(
      shopId,
      String(payment.repairTicketId),
      -amount,
      amount,
    );

    const refundRecord = await this.paymentModel.create({
      shopId: new Types.ObjectId(shopId),
      repairTicketId: payment.repairTicketId,
      amount,
      method: payment.method,
      status: PaymentRecordStatus.REFUNDED,
      recordedBy: new Types.ObjectId(userId),
      parentPaymentId: payment._id,
      idempotencyKey: dto.idempotencyKey,
      note: dto.note || 'Refund',
    });

    return refundRecord.toObject();
  }
}
