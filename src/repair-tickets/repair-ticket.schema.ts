import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { RepairStatus } from '../common/constants/repair-status';
import { TicketPaymentStatus } from '../common/constants/payment';

export enum RepairPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

@Schema({ _id: false })
export class StatusHistoryEntry {
  @Prop({ required: true, enum: RepairStatus, type: String })
  previousStatus!: RepairStatus;

  @Prop({ required: true, enum: RepairStatus, type: String })
  newStatus!: RepairStatus;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  changedBy!: Types.ObjectId;

  @Prop({ default: () => new Date() })
  changedAt!: Date;

  @Prop({ trim: true })
  note?: string;

  @Prop({ default: false })
  customerVisible!: boolean;
}

@Schema({ _id: false })
export class PartUsage {
  @Prop({ type: Types.ObjectId, ref: 'InventoryItem', required: true })
  inventoryItemId!: Types.ObjectId;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  sku!: string;

  @Prop({ required: true, min: 1 })
  quantity!: number;

  @Prop({ required: true })
  unitPrice!: number;

  @Prop({ required: true })
  lineTotal!: number;

  @Prop({ required: true })
  idempotencyKey!: string;

  @Prop({ type: Types.ObjectId, ref: 'StockMovement' })
  stockMovementId?: Types.ObjectId;

  @Prop({ default: () => new Date() })
  usedAt!: Date;
}

@Schema({ _id: false })
export class NoteEntry {
  @Prop({ required: true })
  body!: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy!: Types.ObjectId;

  @Prop({ default: false })
  customerVisible!: boolean;

  @Prop({ default: () => new Date() })
  createdAt!: Date;
}

export type RepairTicketDocument = HydratedDocument<RepairTicket>;

@Schema({ timestamps: true })
export class RepairTicket {
  @Prop({ type: Types.ObjectId, ref: 'Shop', required: true })
  shopId!: Types.ObjectId;

  @Prop({ required: true })
  ticketNumber!: string;

  @Prop({ type: Types.ObjectId, ref: 'Customer', required: true })
  customerId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Device', required: true })
  deviceId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  problemDescription!: string;

  @Prop({ trim: true, default: '' })
  diagnosticFindings!: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  technicianId?: Types.ObjectId;

  @Prop({ enum: RepairPriority, type: String, default: RepairPriority.MEDIUM })
  priority!: RepairPriority;

  @Prop({ enum: RepairStatus, type: String, default: RepairStatus.RECEIVED })
  status!: RepairStatus;

  @Prop({ default: 0 })
  estimatedCost!: number;

  @Prop({ default: 0 })
  finalCost!: number;

  @Prop({ type: [PartUsage], default: [] })
  partsUsed!: PartUsage[];

  @Prop({ default: 0 })
  laborCharge!: number;

  @Prop({ default: 0 })
  discount!: number;

  @Prop({ default: 0 })
  tax!: number;

  @Prop({ default: 0 })
  partsSubtotal!: number;

  @Prop({ default: 0 })
  subtotal!: number;

  @Prop({ default: 0 })
  total!: number;

  @Prop({ default: 0 })
  depositAmount!: number;

  @Prop({ default: 0 })
  totalPaid!: number;

  @Prop({ default: 0 })
  refundedAmount!: number;

  @Prop({ default: 0 })
  outstandingBalance!: number;

  @Prop({ enum: TicketPaymentStatus, type: String, default: TicketPaymentStatus.UNPAID })
  paymentStatus!: TicketPaymentStatus;

  @Prop({ default: false })
  customerApproved!: boolean;

  @Prop()
  approvedEstimate?: number;

  @Prop({ type: [NoteEntry], default: [] })
  notes!: NoteEntry[];

  @Prop({ type: [StatusHistoryEntry], default: [] })
  statusHistory!: StatusHistoryEntry[];

  @Prop({ required: true, select: false })
  trackingTokenHash!: string;

  @Prop()
  completedAt?: Date;

  @Prop()
  deliveredAt?: Date;
}

export const RepairTicketSchema = SchemaFactory.createForClass(RepairTicket);
RepairTicketSchema.index({ shopId: 1, ticketNumber: 1 }, { unique: true });
RepairTicketSchema.index({ shopId: 1, status: 1 });
RepairTicketSchema.index({ shopId: 1, createdAt: -1 });
RepairTicketSchema.index({ shopId: 1, technicianId: 1, status: 1 });
RepairTicketSchema.index({ trackingTokenHash: 1 }, { unique: true });
RepairTicketSchema.index({ shopId: 1, customerId: 1 });
