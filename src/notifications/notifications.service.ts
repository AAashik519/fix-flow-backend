import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { toObjectId } from '../common/utils/object-id.util';
import {
  Notification,
  NotificationDocument,
  NotificationType,
} from './notification.schema';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name) private notificationModel: Model<NotificationDocument>,
  ) {}

  async create(input: {
    shopId: string;
    recipientId: string;
    type: NotificationType;
    title: string;
    message: string;
    relatedTicketId?: string;
    relatedInventoryId?: string;
  }) {
    return this.notificationModel.create({
      shopId: new Types.ObjectId(input.shopId),
      recipientId: new Types.ObjectId(input.recipientId),
      type: input.type,
      title: input.title,
      message: input.message,
      relatedTicketId: input.relatedTicketId
        ? new Types.ObjectId(input.relatedTicketId)
        : undefined,
      relatedInventoryId: input.relatedInventoryId
        ? new Types.ObjectId(input.relatedInventoryId)
        : undefined,
    });
  }

  async notifyShopAdmins(
    shopId: string,
    adminIds: string[],
    payload: Omit<Parameters<NotificationsService['create']>[0], 'shopId' | 'recipientId'>,
  ) {
    await Promise.all(
      adminIds.map((recipientId) => this.create({ shopId, recipientId, ...payload })),
    );
  }

  async findForUser(shopId: string, userId: string, unreadOnly = false) {
    const filter: Record<string, unknown> = {
      shopId: new Types.ObjectId(shopId),
      recipientId: new Types.ObjectId(userId),
    };
    if (unreadOnly) filter.isRead = false;
    const [items, unreadCount] = await Promise.all([
      this.notificationModel.find(filter).sort({ createdAt: -1 }).limit(100).lean(),
      this.notificationModel.countDocuments({
        shopId: new Types.ObjectId(shopId),
        recipientId: new Types.ObjectId(userId),
        isRead: false,
      }),
    ]);
    return { items, unreadCount };
  }

  async markRead(shopId: string, userId: string, id: string) {
    const n = await this.notificationModel
      .findOneAndUpdate(
        { _id: toObjectId(id), shopId: toObjectId(shopId), recipientId: toObjectId(userId) },
        { $set: { isRead: true, readAt: new Date() } },
        { new: true },
      )
      .lean();
    if (!n) throw new NotFoundException('Notification not found');
    return n;
  }

  async markAllRead(shopId: string, userId: string) {
    await this.notificationModel.updateMany(
      { shopId: toObjectId(shopId), recipientId: toObjectId(userId), isRead: false },
      { $set: { isRead: true, readAt: new Date() } },
    );
    return { updated: true };
  }
}
