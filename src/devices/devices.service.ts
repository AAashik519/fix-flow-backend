import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { toObjectId } from '../common/utils/object-id.util';
import { buildPhotoUrl, deleteUploadFile, MAX_PHOTOS } from '../common/utils/upload.util';
import { Customer, CustomerDocument } from '../customers/customer.schema';
import { CreateDeviceDto } from './dto/create-device.dto';
import { QueryDevicesDto } from './dto/query-devices.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { Device, DeviceDocument } from './device.schema';

@Injectable()
export class DevicesService {
  constructor(
    @InjectModel(Device.name) private deviceModel: Model<DeviceDocument>,
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
  ) {}

  async create(shopId: string, dto: CreateDeviceDto) {
    const shopObjectId = toObjectId(shopId);
    const customer = await this.customerModel.findOne({
      _id: toObjectId(dto.customerId),
      shopId: shopObjectId,
    });
    if (!customer) throw new NotFoundException('Customer not found');
    const device = await this.deviceModel.create({
      ...dto,
      shopId: shopObjectId,
      customerId: toObjectId(dto.customerId),
    });
    return device.toObject();
  }

  async findAll(shopId: string, query: QueryDevicesDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const filter: Record<string, unknown> = { shopId: toObjectId(shopId) };
    if (query.customerId) filter.customerId = toObjectId(query.customerId);
    if (query.search) {
      const rx = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ brand: rx }, { model: rx }, { serialOrImei: rx }];
    }
    const [items, total] = await Promise.all([
      this.deviceModel
        .find(filter)
        .populate('customerId', 'name phone')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.deviceModel.countDocuments(filter),
    ]);
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(shopId: string, id: string) {
    const device = await this.deviceModel
      .findOne({ _id: toObjectId(id), shopId: toObjectId(shopId) })
      .populate('customerId', 'name phone email')
      .lean();
    if (!device) throw new NotFoundException('Device not found');
    return device;
  }

  async update(shopId: string, id: string, dto: UpdateDeviceDto) {
    const update: Record<string, unknown> = { ...dto };
    if (dto.customerId) {
      const customer = await this.customerModel.findOne({
        _id: toObjectId(dto.customerId),
        shopId: toObjectId(shopId),
      });
      if (!customer) throw new NotFoundException('Customer not found');
      update.customerId = toObjectId(dto.customerId);
    }
    const device = await this.deviceModel
      .findOneAndUpdate(
        { _id: toObjectId(id), shopId: toObjectId(shopId) },
        { $set: update },
        { new: true },
      )
      .populate('customerId', 'name phone')
      .lean();
    if (!device) throw new NotFoundException('Device not found');
    return device;
  }

  async remove(shopId: string, id: string) {
    const result = await this.deviceModel.findOneAndDelete({
      _id: toObjectId(id),
      shopId: toObjectId(shopId),
    });
    if (!result) throw new NotFoundException('Device not found');
    for (const url of result.photoUrls || []) {
      deleteUploadFile(url);
    }
    return { deleted: true };
  }

  async addPhotos(shopId: string, id: string, files: Express.Multer.File[]) {
    if (!files?.length) throw new BadRequestException('At least one photo is required');
    const device = await this.deviceModel.findOne({
      _id: toObjectId(id),
      shopId: toObjectId(shopId),
    });
    if (!device) throw new NotFoundException('Device not found');

    const existing = device.photoUrls || [];
    if (existing.length + files.length > MAX_PHOTOS) {
      for (const file of files) deleteUploadFile(buildPhotoUrl('devices', file.filename));
      throw new BadRequestException(`Maximum ${MAX_PHOTOS} photos allowed per device`);
    }

    const urls = files.map((f) => buildPhotoUrl('devices', f.filename));
    device.photoUrls = [...existing, ...urls];
    await device.save();
    return device.toObject();
  }

  async removePhoto(shopId: string, id: string, url: string) {
    const device = await this.deviceModel.findOne({
      _id: toObjectId(id),
      shopId: toObjectId(shopId),
    });
    if (!device) throw new NotFoundException('Device not found');
    if (!(device.photoUrls || []).includes(url)) {
      throw new NotFoundException('Photo not found on this device');
    }
    device.photoUrls = (device.photoUrls || []).filter((u) => u !== url);
    await device.save();
    deleteUploadFile(url);
    return device.toObject();
  }
}
