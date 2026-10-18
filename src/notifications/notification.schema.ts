import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum NotificationType {
  TICKET_CREATED = 'TICKET_CREATED',
  TECHNICIAN_ASSIGNED = 'TECHNICIAN_ASSIGNED',
  DIAGNOSIS_COMPLETED = 'DIAGNOSIS_COMPLETED',
  APPROVAL_REQUESTED = 'APPROVAL_REQUESTED',
  PARTS_UNAVAILABLE = 'PARTS_UNAVAILABLE',
  REPAIR_COMPLETED = 'REPAIR_COMPLETED',
  READY_FOR_PICKUP = 'READY_FOR_PICKUP',
  PAYMENT_RECORDED = 'PAYMENT_RECORDED',
  LOW_STOCK = 'LOW_STOCK',
  STATUS_CHANGED = 'STATUS_CHANGED',
}

export type NotificationDocument = HydratedDocument<Notification>;

@Schema({ timestamps: true })
export class Notification {
  @Prop({ type: Types.ObjectId, ref: 'Shop', required: true })
  shopId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  recipientId!: Types.ObjectId;

  @Prop({ required: true, enum: NotificationType, type: String })
  type!: NotificationType;

  @Prop({ required: true })
  title!: string;

  @Prop({ required: true })
  message!: string;

  @Prop({ type: Types.ObjectId })
  relatedTicketId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId })
  relatedInventoryId?: Types.ObjectId;

  @Prop({ default: false })
  isRead!: boolean;

  @Prop()
  readAt?: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
NotificationSchema.index({ shopId: 1, recipientId: 1, isRead: 1, createdAt: -1 });
