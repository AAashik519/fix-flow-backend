import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type TicketCounterDocument = HydratedDocument<TicketCounter>;

@Schema()
export class TicketCounter {
  @Prop({ type: Types.ObjectId, ref: 'Shop', required: true })
  shopId!: Types.ObjectId;

  @Prop({ required: true })
  dateKey!: string;

  @Prop({ required: true, default: 0 })
  seq!: number;
}

export const TicketCounterSchema = SchemaFactory.createForClass(TicketCounter);
TicketCounterSchema.index({ shopId: 1, dateKey: 1 }, { unique: true });
