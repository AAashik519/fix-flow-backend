import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CustomerDocument = HydratedDocument<Customer>;

@Schema({ timestamps: true })
export class Customer {
  @Prop({ type: Types.ObjectId, ref: 'Shop', required: true, index: true })
  shopId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, trim: true })
  phone!: string;

  @Prop({ required: true, trim: true })
  phoneNormalized!: string;

  @Prop({ required: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ trim: true })
  address?: string;

  @Prop({ trim: true, default: '' })
  notes?: string;
}

export const CustomerSchema = SchemaFactory.createForClass(Customer);
CustomerSchema.index({ shopId: 1, phoneNormalized: 1 }, { unique: true });
CustomerSchema.index({ shopId: 1, name: 'text', phone: 'text', email: 'text' });
CustomerSchema.index({ shopId: 1, createdAt: -1 });
