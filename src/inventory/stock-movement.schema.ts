import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum StockMovementType {
  PURCHASE = 'PURCHASE',
  ADJUSTMENT = 'ADJUSTMENT',
  CONSUMPTION = 'CONSUMPTION',
  RETURN = 'RETURN',
}

export type StockMovementDocument = HydratedDocument<StockMovement>;

@Schema({ timestamps: true })
export class StockMovement {
  @Prop({ type: Types.ObjectId, ref: 'Shop', required: true })
  shopId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'InventoryItem', required: true })
  inventoryItemId!: Types.ObjectId;

  @Prop({ required: true, enum: StockMovementType, type: String })
  type!: StockMovementType;

  /** Signed quantity change: positive for in, negative for out */
  @Prop({ required: true })
  quantityChange!: number;

  @Prop({ required: true, min: 0 })
  quantityAfter!: number;

  @Prop({ type: Types.ObjectId, ref: 'RepairTicket' })
  repairTicketId?: Types.ObjectId;

  @Prop()
  unitCostSnapshot?: number;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy!: Types.ObjectId;

  @Prop({ trim: true })
  note?: string;

  @Prop({ required: true })
  idempotencyKey!: string;
}

export const StockMovementSchema = SchemaFactory.createForClass(StockMovement);
StockMovementSchema.index({ shopId: 1, createdAt: -1 });
StockMovementSchema.index({ shopId: 1, inventoryItemId: 1, createdAt: -1 });
StockMovementSchema.index({ shopId: 1, idempotencyKey: 1 }, { unique: true });
