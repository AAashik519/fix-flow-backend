import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { RepairStatus } from '../common/constants/repair-status';
import { PaymentRecordStatus } from '../common/constants/payment';
import { InventoryItem, InventoryItemDocument } from '../inventory/inventory-item.schema';
import { StockMovement, StockMovementDocument } from '../inventory/stock-movement.schema';
import { Payment, PaymentDocument } from '../payments/payment.schema';
import { RepairTicket, RepairTicketDocument } from '../repair-tickets/repair-ticket.schema';
import { User, UserDocument } from '../users/user.schema';
import { UserRole } from '../common/constants/roles';
import { QueryReportsDto } from './dto/query-reports.dto';

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(RepairTicket.name) private ticketModel: Model<RepairTicketDocument>,
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(InventoryItem.name) private inventoryModel: Model<InventoryItemDocument>,
    @InjectModel(StockMovement.name) private movementModel: Model<StockMovementDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  private dateFilter(from?: string, to?: string) {
    if (!from && !to) return undefined;
    const createdAt: Record<string, Date> = {};
    if (from) createdAt.$gte = new Date(from);
    if (to) createdAt.$lte = new Date(to);
    return createdAt;
  }

  async repairs(shopId: string, query: QueryReportsDto) {
    const filter: Record<string, unknown> = { shopId: new Types.ObjectId(shopId) };
    const createdAt = this.dateFilter(query.from, query.to);
    if (createdAt) filter.createdAt = createdAt;
    return this.ticketModel
      .find(filter)
      .populate('customerId', 'name phone')
      .populate('technicianId', 'name')
      .select('-trackingTokenHash -notes')
      .sort({ createdAt: -1 })
      .lean();
  }

  async payments(shopId: string, query: QueryReportsDto) {
    const filter: Record<string, unknown> = {
      shopId: new Types.ObjectId(shopId),
      status: PaymentRecordStatus.SUCCESS,
    };
    const createdAt = this.dateFilter(query.from, query.to);
    if (createdAt) filter.createdAt = createdAt;
    return this.paymentModel
      .find(filter)
      .populate('repairTicketId', 'ticketNumber')
      .sort({ createdAt: -1 })
      .lean();
  }

  async inventory(shopId: string) {
    const [items, movements] = await Promise.all([
      this.inventoryModel.find({ shopId }).sort({ name: 1 }).lean(),
      this.movementModel.find({ shopId }).sort({ createdAt: -1 }).limit(200).lean(),
    ]);
    return { items, movements };
  }

  async technicianPerformance(shopId: string, query: QueryReportsDto) {
    const match: Record<string, unknown> = {
      shopId: new Types.ObjectId(shopId),
      technicianId: { $exists: true, $ne: null },
    };
    const createdAt = this.dateFilter(query.from, query.to);
    if (createdAt) match.createdAt = createdAt;

    const rows = await this.ticketModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$technicianId',
          totalAssigned: { $sum: 1 },
          completed: {
            $sum: {
              $cond: [
                {
                  $in: [
                    '$status',
                    [
                      RepairStatus.COMPLETED,
                      RepairStatus.READY_FOR_PICKUP,
                      RepairStatus.DELIVERED,
                    ],
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    const techs = await this.userModel
      .find({ shopId, role: UserRole.TECHNICIAN })
      .select('name email')
      .lean();
    const map = new Map(techs.map((t) => [String(t._id), t]));

    return rows.map((r) => ({
      technicianId: String(r._id),
      name: map.get(String(r._id))?.name || 'Unknown',
      email: map.get(String(r._id))?.email,
      totalAssigned: r.totalAssigned,
      completed: r.completed,
    }));
  }

  toCsv(rows: Record<string, unknown>[]): string {
    if (!rows.length) return '';
    const headers = Object.keys(rows[0]);
    const lines = [headers.join(',')];
    for (const row of rows) {
      lines.push(
        headers
          .map((h) => {
            const val = row[h];
            const str = val == null ? '' : String(val).replace(/"/g, '""');
            return `"${str}"`;
          })
          .join(','),
      );
    }
    return lines.join('\n');
  }

  async export(shopId: string, query: QueryReportsDto) {
    const type = query.type || 'repairs';
    if (type === 'payments') {
      const data = await this.payments(shopId, query);
      const flat = data.map((p) => ({
        id: String(p._id),
        amount: p.amount,
        method: p.method,
        status: p.status,
        createdAt: (p as { createdAt?: Date }).createdAt,
      }));
      return { csv: this.toCsv(flat), filename: 'payments-report.csv' };
    }
    if (type === 'inventory') {
      const data = await this.inventory(shopId);
      const flat = data.items.map((i) => ({
        sku: i.sku,
        name: i.name,
        quantity: i.quantity,
        sellingPrice: i.sellingPrice,
      }));
      return { csv: this.toCsv(flat), filename: 'inventory-report.csv' };
    }
    if (type === 'technicians') {
      const data = await this.technicianPerformance(shopId, query);
      return { csv: this.toCsv(data as unknown as Record<string, unknown>[]), filename: 'technicians-report.csv' };
    }
    const data = await this.repairs(shopId, query);
    const flat = data.map((t) => ({
      ticketNumber: t.ticketNumber,
      status: t.status,
      total: t.total,
      outstandingBalance: t.outstandingBalance,
      paymentStatus: t.paymentStatus,
    }));
    return { csv: this.toCsv(flat), filename: 'repairs-report.csv' };
  }
}
