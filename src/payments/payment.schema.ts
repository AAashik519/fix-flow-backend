import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { PaymentMethod, PaymentRecordStatus } from '../common/constants/payment';

export type PaymentDocument = HydratedDocument<Payment>;

@Schema({ timestamps: true })
export class Payment {
  @Prop({ type: Types.ObjectId, ref: 'Shop', required: true })
  shopId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'RepairTicket', required: true })
  repairTicketId!: Types.ObjectId;

  @Prop({ required: true, min: 0.01 })
  amount!: number;

  @Prop({ required: true, enum: PaymentMethod, type: String })
  method!: PaymentMethod;

  @Prop({ enum: PaymentRecordStatus, type: String, default: PaymentRecordStatus.SUCCESS })
  status!: PaymentRecordStatus;

  @Prop({ trim: true })
  transactionReference?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  recordedBy!: Types.ObjectId;

  @Prop({ default: 0 })
  refundedAmount!: number;

  @Prop({ type: Types.ObjectId, ref: 'Payment' })
  parentPaymentId?: Types.ObjectId;

  @Prop({ required: true })
  idempotencyKey!: string;

  @Prop({ trim: true })
  note?: string;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
PaymentSchema.index({ shopId: 1, createdAt: -1 });
PaymentSchema.index({ shopId: 1, repairTicketId: 1 });
PaymentSchema.index({ shopId: 1, idempotencyKey: 1 }, { unique: true });
