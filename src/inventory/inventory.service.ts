import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { toObjectId } from '../common/utils/object-id.util';
import { buildPhotoUrl, deleteUploadFile, MAX_PHOTOS } from '../common/utils/upload.util';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { CreateStockMovementDto } from './dto/stock-movement.dto';
import { QueryInventoryDto } from './dto/query-inventory.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { InventoryItem, InventoryItemDocument } from './inventory-item.schema';
import {
  StockMovement,
  StockMovementDocument,
  StockMovementType,
} from './stock-movement.schema';

@Injectable()
export class InventoryService {
  constructor(
    @InjectModel(InventoryItem.name) private inventoryModel: Model<InventoryItemDocument>,
    @InjectModel(StockMovement.name) private movementModel: Model<StockMovementDocument>,
  ) {}

  async create(shopId: string, dto: CreateInventoryDto) {
    try {
      const item = await this.inventoryModel.create({
        ...dto,
        sku: dto.sku.toUpperCase(),
        shopId: new Types.ObjectId(shopId),
      });
      return item.toObject();
    } catch (err: unknown) {
      if ((err as { code?: number }).code === 11000) {
        throw new ConflictException('SKU already exists in this shop');
      }
      throw err;
    }
  }

  async findAll(shopId: string, query: QueryInventoryDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const filter: Record<string, unknown> = { shopId: new Types.ObjectId(shopId) };
    if (query.category) filter.category = query.category;
    if (query.search) {
      const rx = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: rx }, { sku: rx }, { brand: rx }];
    }
    const [items, total] = await Promise.all([
      this.inventoryModel
        .find(filter)
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.inventoryModel.countDocuments(filter),
    ]);
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(shopId: string, id: string) {
    const item = await this.inventoryModel.findOne({ _id: toObjectId(id), shopId: toObjectId(shopId) }).lean();
    if (!item) throw new NotFoundException('Inventory item not found');
    return item;
  }

  async update(shopId: string, id: string, dto: UpdateInventoryDto) {
    const item = await this.inventoryModel
      .findOneAndUpdate({ _id: toObjectId(id), shopId: toObjectId(shopId) }, { $set: dto }, { new: true })
      .lean();
    if (!item) throw new NotFoundException('Inventory item not found');
    return item;
  }

  async addPhotos(shopId: string, id: string, files: Express.Multer.File[]) {
    if (!files?.length) throw new BadRequestException('At least one photo is required');
    const item = await this.inventoryModel.findOne({
      _id: toObjectId(id),
      shopId: toObjectId(shopId),
    });
    if (!item) throw new NotFoundException('Inventory item not found');

    const existing = item.photoUrls || [];
    if (existing.length + files.length > MAX_PHOTOS) {
      for (const file of files) deleteUploadFile(buildPhotoUrl('inventory', file.filename));
      throw new BadRequestException(`Maximum ${MAX_PHOTOS} photos allowed per item`);
    }

    const urls = files.map((f) => buildPhotoUrl('inventory', f.filename));
    item.photoUrls = [...existing, ...urls];
    await item.save();
    return item.toObject();
  }

  async removePhoto(shopId: string, id: string, url: string) {
    const item = await this.inventoryModel.findOne({
      _id: toObjectId(id),
      shopId: toObjectId(shopId),
    });
    if (!item) throw new NotFoundException('Inventory item not found');
    if (!(item.photoUrls || []).includes(url)) {
      throw new NotFoundException('Photo not found on this item');
    }
    item.photoUrls = (item.photoUrls || []).filter((u) => u !== url);
    await item.save();
    deleteUploadFile(url);
    return item.toObject();
  }

  async lowStock(shopId: string) {
    return this.inventoryModel
      .find({
        shopId: new Types.ObjectId(shopId),
        $expr: { $lte: ['$quantity', '$lowStockThreshold'] },
      })
      .sort({ quantity: 1 })
      .lean();
  }

  async addMovement(shopId: string, userId: string, id: string, dto: CreateStockMovementDto) {
    if (dto.type === StockMovementType.CONSUMPTION) {
      throw new BadRequestException('Use repair ticket parts endpoint for consumption');
    }

    const existing = await this.movementModel.findOne({ shopId: toObjectId(shopId), idempotencyKey: dto.idempotencyKey });
    if (existing) return existing.toObject();

    if (dto.quantityChange === 0) {
      throw new BadRequestException('quantityChange cannot be zero');
    }

    const item = await this.inventoryModel.findOne({ _id: toObjectId(id), shopId: toObjectId(shopId) });
    if (!item) throw new NotFoundException('Inventory item not found');

    const nextQty = item.quantity + dto.quantityChange;
    if (nextQty < 0) throw new BadRequestException('Stock cannot become negative');

    const updated = await this.inventoryModel.findOneAndUpdate(
      {
        _id: toObjectId(id),
        shopId: toObjectId(shopId),
        ...(dto.quantityChange < 0
          ? { quantity: { $gte: Math.abs(dto.quantityChange) } }
          : {}),
      },
      { $inc: { quantity: dto.quantityChange } },
      { new: true },
    );
    if (!updated) throw new BadRequestException('Stock cannot become negative');

    const movement = await this.movementModel.create({
      shopId: new Types.ObjectId(shopId),
      inventoryItemId: updated._id,
      type: dto.type,
      quantityChange: dto.quantityChange,
      quantityAfter: updated.quantity,
      unitCostSnapshot: updated.purchaseCost,
      createdBy: new Types.ObjectId(userId),
      note: dto.note,
      idempotencyKey: dto.idempotencyKey,
    });
    return movement.toObject();
  }

  async listMovements(shopId: string, id: string) {
    await this.findOne(shopId, id);
    return this.movementModel
      .find({ shopId: toObjectId(shopId), inventoryItemId: toObjectId(id) })
      .sort({ createdAt: -1 })
      .lean();
  }
}
