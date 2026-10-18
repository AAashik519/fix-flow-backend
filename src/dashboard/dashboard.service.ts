import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { RepairStatus } from '../common/constants/repair-status';
import { PaymentRecordStatus } from '../common/constants/payment';
import { InventoryItem, InventoryItemDocument } from '../inventory/inventory-item.schema';
import { Payment, PaymentDocument } from '../payments/payment.schema';
import { RepairTicket, RepairTicketDocument } from '../repair-tickets/repair-ticket.schema';
import { User, UserDocument } from '../users/user.schema';
import { UserRole } from '../common/constants/roles';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(RepairTicket.name) private ticketModel: Model<RepairTicketDocument>,
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(InventoryItem.name) private inventoryModel: Model<InventoryItemDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  private shopOid(shopId: string) {
    return new Types.ObjectId(shopId);
  }

  async overview(shopId: string) {
    const shopObjectId = this.shopOid(shopId);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [
      totalTickets,
      receivedToday,
      inProgress,
      waitingForParts,
      completed,
      readyForPickup,
      lowStockItems,
      revenueAgg,
      outstandingAgg,
    ] = await Promise.all([
      this.ticketModel.countDocuments({ shopId: shopObjectId }),
      this.ticketModel.countDocuments({
        shopId: shopObjectId,
        createdAt: { $gte: startOfDay },
      }),
      this.ticketModel.countDocuments({
        shopId: shopObjectId,
        status: RepairStatus.IN_PROGRESS,
      }),
      this.ticketModel.countDocuments({
        shopId: shopObjectId,
        status: RepairStatus.WAITING_FOR_PARTS,
      }),
      this.ticketModel.countDocuments({
        shopId: shopObjectId,
        status: RepairStatus.COMPLETED,
      }),
      this.ticketModel.countDocuments({
        shopId: shopObjectId,
        status: RepairStatus.READY_FOR_PICKUP,
      }),
      this.inventoryModel.countDocuments({
        shopId: shopObjectId,
        $expr: { $lte: ['$quantity', '$lowStockThreshold'] },
      }),
      this.paymentModel.aggregate([
        {
          $match: {
            shopId: shopObjectId,
            status: PaymentRecordStatus.SUCCESS,
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      this.ticketModel.aggregate([
        {
          $match: {
            shopId: shopObjectId,
            status: { $ne: RepairStatus.CANCELLED },
          },
        },
        { $group: { _id: null, total: { $sum: '$outstandingBalance' } } },
      ]),
    ]);

    return {
      totalRepairTickets: totalTickets,
      repairsReceivedToday: receivedToday,
      repairsInProgress: inProgress,
      repairsWaitingForParts: waitingForParts,
      completedRepairs: completed,
      readyForPickup,
      lowStockItems,
      revenueCollected: revenueAgg[0]?.total || 0,
      outstandingBalances: outstandingAgg[0]?.total || 0,
    };
  }

  async repairStatistics(shopId: string) {
    const shopObjectId = this.shopOid(shopId);
    const byStatus = await this.ticketModel.aggregate([
      { $match: { shopId: shopObjectId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const receivedOverTime = await this.ticketModel.aggregate([
      { $match: { shopId: shopObjectId } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 30 },
    ]);

    const completedOverTime = await this.ticketModel.aggregate([
      {
        $match: {
          shopId: shopObjectId,
          completedAt: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$completedAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 30 },
    ]);

    return {
      byStatus: byStatus.map((s) => ({ status: s._id, count: s.count })),
      receivedOverTime: receivedOverTime.map((d) => ({ date: d._id, count: d.count })),
      completedOverTime: completedOverTime.map((d) => ({ date: d._id, count: d.count })),
    };
  }

  async revenueStatistics(shopId: string) {
    const shopObjectId = this.shopOid(shopId);
    const byDay = await this.paymentModel.aggregate([
      {
        $match: {
          shopId: shopObjectId,
          status: PaymentRecordStatus.SUCCESS,
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          amount: { $sum: '$amount' },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 60 },
    ]);

    const topParts = await this.ticketModel.aggregate([
      { $match: { shopId: shopObjectId } },
      { $unwind: '$partsUsed' },
      {
        $group: {
          _id: '$partsUsed.sku',
          name: { $first: '$partsUsed.name' },
          quantity: { $sum: '$partsUsed.quantity' },
        },
      },
      { $sort: { quantity: -1 } },
      { $limit: 10 },
    ]);

    return {
      revenueByDay: byDay.map((d) => ({ date: d._id, amount: d.amount })),
      topParts: topParts.map((p) => ({
        sku: p._id,
        name: p.name,
        quantity: p.quantity,
      })),
    };
  }

  async technicianWorkload(shopId: string) {
    const shopObjectId = this.shopOid(shopId);
    const workload = await this.ticketModel.aggregate([
      {
        $match: {
          shopId: shopObjectId,
          technicianId: { $exists: true, $ne: null },
          status: {
            $nin: [RepairStatus.DELIVERED, RepairStatus.CANCELLED],
          },
        },
      },
      { $group: { _id: '$technicianId', activeTickets: { $sum: 1 } } },
    ]);

    const techIds = workload.map((w) => w._id);
    const techs = await this.userModel
      .find({ _id: { $in: techIds }, role: UserRole.TECHNICIAN })
      .select('name email')
      .lean();
    const map = new Map(techs.map((t) => [String(t._id), t]));

    return workload.map((w) => ({
      technicianId: String(w._id),
      name: map.get(String(w._id))?.name || 'Unknown',
      email: map.get(String(w._id))?.email,
      activeTickets: w.activeTickets,
    }));
  }
}
