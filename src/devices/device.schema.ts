import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum DeviceCategory {
  MOBILE = 'MOBILE',
  LAPTOP = 'LAPTOP',
  DESKTOP = 'DESKTOP',
  TABLET = 'TABLET',
  OTHER = 'OTHER',
}

export type DeviceDocument = HydratedDocument<Device>;

@Schema({ timestamps: true })
export class Device {
  @Prop({ type: Types.ObjectId, ref: 'Shop', required: true, index: true })
  shopId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Customer', required: true, index: true })
  customerId!: Types.ObjectId;

  @Prop({ required: true, enum: DeviceCategory, type: String })
  category!: DeviceCategory;

  @Prop({ required: true, trim: true })
  brand!: string;

  @Prop({ required: true, trim: true })
  model!: string;

  @Prop({ trim: true })
  serialOrImei?: string;

  @Prop({ trim: true, default: '' })
  intakeCondition?: string;

  @Prop({ type: [String], default: [] })
  accessories!: string[];

  @Prop({ trim: true, default: '' })
  reportedProblem?: string;

  @Prop({ type: [String], default: [] })
  photoUrls!: string[];
}

export const DeviceSchema = SchemaFactory.createForClass(Device);
DeviceSchema.index({ shopId: 1, customerId: 1 });
DeviceSchema.index({ shopId: 1, createdAt: -1 });
