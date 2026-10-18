import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ShopDocument = HydratedDocument<Shop>;

@Schema({ _id: false })
export class ShopSettings {
  @Prop({ default: true })
  requirePaymentBeforeDelivery!: boolean;

  @Prop({ default: 0 })
  defaultTaxRate!: number;

  @Prop({ default: '' })
  receiptFooter!: string;
}

@Schema({ timestamps: true })
export class Shop {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  slug!: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  ownerId?: Types.ObjectId;

  @Prop({ trim: true })
  phone?: string;

  @Prop({ trim: true })
  address?: string;

  @Prop({ default: 'BDT' })
  currency!: string;

  @Prop({ default: 'Asia/Dhaka' })
  timezone!: string;

  @Prop({ type: ShopSettings, default: () => ({}) })
  settings!: ShopSettings;
}

export const ShopSchema = SchemaFactory.createForClass(Shop);
