import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type InventoryItemDocument = HydratedDocument<InventoryItem>;

@Schema({ timestamps: true })
export class InventoryItem {
  @Prop({ type: Types.ObjectId, ref: 'Shop', required: true })
  shopId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, trim: true, uppercase: true })
  sku!: string;

  @Prop({ required: true, trim: true })
  category!: string;

  @Prop({ trim: true })
  brand?: string;

  @Prop({ type: [String], default: [] })
  compatibleDevices!: string[];

  @Prop({ required: true, min: 0 })
  purchaseCost!: number;

  @Prop({ required: true, min: 0 })
  sellingPrice!: number;

  @Prop({ required: true, min: 0, default: 0 })
  quantity!: number;

  @Prop({ required: true, min: 0, default: 5 })
  lowStockThreshold!: number;

  @Prop({ trim: true })
  supplierName?: string;

  @Prop({ trim: true })
  supplierContact?: string;

  @Prop({ type: [String], default: [] })
  photoUrls!: string[];
}

export const InventoryItemSchema = SchemaFactory.createForClass(InventoryItem);
InventoryItemSchema.index({ shopId: 1, sku: 1 }, { unique: true });
InventoryItemSchema.index({ shopId: 1, name: 'text', sku: 'text' });
InventoryItemSchema.index({ shopId: 1, quantity: 1 });
