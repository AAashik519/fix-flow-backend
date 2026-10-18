import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UpdateShopDto } from './dto/update-shop.dto';
import { Shop, ShopDocument } from './shop.schema';

@Injectable()
export class ShopsService {
  constructor(@InjectModel(Shop.name) private shopModel: Model<ShopDocument>) {}

  async getMine(shopId: string) {
    const shop = await this.shopModel.findById(shopId).lean();
    if (!shop) throw new NotFoundException('Shop not found');
    return shop;
  }

  async update(shopId: string, dto: UpdateShopDto) {
    const shop = await this.shopModel
      .findByIdAndUpdate(shopId, { $set: dto }, { new: true })
      .lean();
    if (!shop) throw new NotFoundException('Shop not found');
    return shop;
  }
}
