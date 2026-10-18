import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { toObjectId } from '../common/utils/object-id.util';
import { UserRole } from '../common/constants/roles';
import { RepairStatus } from '../common/constants/repair-status';
import { TicketPaymentStatus } from '../common/constants/payment';
import {
  calculateRepairTotals,
  deriveTicketPaymentStatus,
  roundMoney,
} from '../common/utils/money.util';
import {
  generateTrackingToken,
  hashTrackingToken,
} from '../common/utils/tracking-token.util';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { Customer, CustomerDocument } from '../customers/customer.schema';
import { Device, DeviceDocument } from '../devices/device.schema';
import {
  TicketCounter,
  TicketCounterDocument,
} from '../database/ticket-counter.schema';
import {
  InventoryItem,
  InventoryItemDocument,
} from '../inventory/inventory-item.schema';
import {
  StockMovement,
  StockMovementDocument,
  StockMovementType,
} from '../inventory/stock-movement.schema';
import { MailService } from '../mail/mail.service';
import { NotificationType } from '../notifications/notification.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { Shop, ShopDocument } from '../shops/shop.schema';
import { User, UserDocument } from '../users/user.schema';
import { AddNoteDto } from './dto/add-note.dto';
import { AddPartsDto } from './dto/add-parts.dto';
import { AssignTechnicianDto } from './dto/assign-technician.dto';
import { CreateRepairTicketDto } from './dto/create-repair-ticket.dto';
import { DiagnosticsDto } from './dto/diagnostics.dto';
import { QueryRepairTicketsDto } from './dto/query-repair-tickets.dto';
import { UpdateRepairStatusDto } from './dto/update-repair-status.dto';
import { UpdateRepairTicketDto } from './dto/update-repair-ticket.dto';
import {
  RepairTicket,
  RepairTicketDocument,
} from './repair-ticket.schema';
import { StatusTransitionService } from './status-transition.service';

@Injectable()
export class RepairTicketsService {
  private readonly logger = new Logger(RepairTicketsService.name);

  constructor(
    @InjectModel(RepairTicket.name) private ticketModel: Model<RepairTicketDocument>,
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
    @InjectModel(Device.name) private deviceModel: Model<DeviceDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Shop.name) private shopModel: Model<ShopDocument>,
    @InjectModel(InventoryItem.name) private inventoryModel: Model<InventoryItemDocument>,
    @InjectModel(StockMovement.name) private movementModel: Model<StockMovementDocument>,
    @InjectModel(TicketCounter.name) private counterModel: Model<TicketCounterDocument>,
    @InjectConnection() private connection: Connection,
    private statusTransition: StatusTransitionService,
    private notifications: NotificationsService,
    private mail: MailService,
    private config: ConfigService,
  ) {}

  private async nextTicketNumber(shopId: string, session?: import('mongoose').ClientSession) {
    const dateKey = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const counter = await this.counterModel.findOneAndUpdate(
      { shopId: new Types.ObjectId(shopId), dateKey },
      { $inc: { seq: 1 } },
      { upsert: true, new: true, session },
    );
    const seq = String(counter.seq).padStart(4, '0');
    return `FF-${dateKey}-${seq}`;
  }

  private recalculate(ticket: RepairTicketDocument) {
    const partsSubtotal = roundMoney(
      (ticket.partsUsed || []).reduce((sum, p) => sum + p.lineTotal, 0),
    );
    const totals = calculateRepairTotals({
      partsSubtotal,
      laborCharge: ticket.laborCharge,
      discount: ticket.discount,
      tax: ticket.tax,
      totalPaid: ticket.totalPaid,
    });
    ticket.partsSubtotal = totals.partsSubtotal;
    ticket.subtotal = totals.subtotal;
    ticket.total = totals.total;
    ticket.outstandingBalance = totals.outstandingBalance;
    ticket.finalCost = totals.total;
    ticket.paymentStatus = deriveTicketPaymentStatus(
      totals.total,
      totals.totalPaid,
      ticket.refundedAmount,
    ) as TicketPaymentStatus;
  }

  private async getAdminIds(shopId: string): Promise<string[]> {
    const admins = await this.userModel
      .find({ shopId, role: UserRole.ADMIN, isActive: true })
      .select('_id')
      .lean();
    return admins.map((a) => String(a._id));
  }

  async create(user: AuthUser, dto: CreateRepairTicketDto) {
    const customer = await this.customerModel.findOne({
      _id: toObjectId(dto.customerId),
      shopId: toObjectId(user.shopId),
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const device = await this.deviceModel.findOne({
      _id: toObjectId(dto.deviceId),
      shopId: toObjectId(user.shopId),
      customerId: toObjectId(dto.customerId),
    });
    if (!device) throw new NotFoundException('Device not found for customer');

    if (dto.technicianId) {
      const tech = await this.userModel.findOne({
        _id: toObjectId(dto.technicianId),
        shopId: toObjectId(user.shopId),
        role: UserRole.TECHNICIAN,
        isActive: true,
      });
      if (!tech) throw new NotFoundException('Technician not found');
    }

    const trackingToken = generateTrackingToken();
    const ticketNumber = await this.nextTicketNumber(user.shopId);
    const laborCharge = dto.laborCharge ?? 0;
    const estimatedCost = dto.estimatedCost ?? 0;
    const depositAmount = dto.depositAmount ?? 0;

    const ticket = new this.ticketModel({
      shopId: new Types.ObjectId(user.shopId),
      ticketNumber,
      customerId: new Types.ObjectId(dto.customerId),
      deviceId: new Types.ObjectId(dto.deviceId),
      problemDescription: dto.problemDescription,
      priority: dto.priority,
      technicianId: dto.technicianId
        ? new Types.ObjectId(dto.technicianId)
        : undefined,
      estimatedCost,
      laborCharge,
      depositAmount,
      trackingTokenHash: hashTrackingToken(trackingToken),
      status: RepairStatus.RECEIVED,
      statusHistory: [
        {
          previousStatus: RepairStatus.RECEIVED,
          newStatus: RepairStatus.RECEIVED,
          changedBy: new Types.ObjectId(user.userId),
          changedAt: new Date(),
          note: 'Ticket created',
          customerVisible: true,
        },
      ],
    });
    this.recalculate(ticket);
    await ticket.save();

    const adminIds = await this.getAdminIds(user.shopId);
    await this.notifications.notifyShopAdmins(user.shopId, adminIds, {
      type: NotificationType.TICKET_CREATED,
      title: 'New repair ticket',
      message: `Ticket ${ticketNumber} created for ${customer.name}`,
      relatedTicketId: String(ticket._id),
    });

    if (dto.technicianId) {
      await this.notifications.create({
        shopId: user.shopId,
        recipientId: dto.technicianId,
        type: NotificationType.TECHNICIAN_ASSIGNED,
        title: 'Repair assigned',
        message: `You were assigned to ticket ${ticketNumber}`,
        relatedTicketId: String(ticket._id),
      });
    }

    const trackingUrl = `${this.config.get<string>('frontendUrl')}/track/${trackingToken}`;
    let trackingEmailSent = false;
    if (customer.email) {
      try {
        trackingEmailSent = await this.mail.sendTrackingLink({
          to: customer.email,
          customerName: customer.name,
          ticketNumber,
          trackingUrl,
        });
      } catch (err) {
        this.logger.error(`Tracking email failed for ${customer.email}`, err instanceof Error ? err.stack : err);
      }
    }

    const obj = ticket.toObject();
    delete (obj as { trackingTokenHash?: string }).trackingTokenHash;
    return { ...obj, trackingToken, trackingUrl, trackingEmailSent };
  }

  async findAll(user: AuthUser, query: QueryRepairTicketsDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const filter: Record<string, unknown> = {
      shopId: new Types.ObjectId(user.shopId),
    };

    if (user.role === UserRole.TECHNICIAN || query.assignedToMe) {
      filter.technicianId = new Types.ObjectId(user.userId);
    } else if (query.technicianId) {
      filter.technicianId = new Types.ObjectId(query.technicianId);
    }

    if (query.status) filter.status = query.status;
    if (query.priority) filter.priority = query.priority;
    if (query.from || query.to) {
      filter.createdAt = {};
      if (query.from) (filter.createdAt as Record<string, Date>).$gte = new Date(query.from);
      if (query.to) (filter.createdAt as Record<string, Date>).$lte = new Date(query.to);
    }

    if (query.search) {
      const rx = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const customers = await this.customerModel
        .find({
          shopId: toObjectId(user.shopId),
          $or: [{ name: rx }, { phone: rx }, { phoneNormalized: rx }],
        })
        .select('_id')
        .lean();
      filter.$or = [
        { ticketNumber: rx },
        { customerId: { $in: customers.map((c) => c._id) } },
      ];
    }

    const [items, total] = await Promise.all([
      this.ticketModel
        .find(filter)
        .populate('customerId', 'name phone email')
        .populate('deviceId', 'category brand model serialOrImei')
        .populate('technicianId', 'name email')
        .select('-trackingTokenHash')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.ticketModel.countDocuments(filter),
    ]);

    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  private async getScopedTicket(shopId: string, id: string, user?: AuthUser) {
    const ticket = await this.ticketModel
      .findOne({ _id: toObjectId(id), shopId: toObjectId(shopId) })
      .select('+trackingTokenHash')
      .exec();
    if (!ticket) throw new NotFoundException('Repair ticket not found');
    if (
      user?.role === UserRole.TECHNICIAN &&
      ticket.technicianId &&
      String(ticket.technicianId) !== user.userId
    ) {
      throw new ForbiddenException('Not assigned to this ticket');
    }
    return ticket;
  }

  async findOne(user: AuthUser, id: string) {
    const ticket = await this.getScopedTicket(user.shopId, id, user);
    return this.ticketModel
      .findById(ticket._id)
      .populate('customerId', 'name phone email address')
      .populate('deviceId')
      .populate('technicianId', 'name email')
      .populate('statusHistory.changedBy', 'name role')
      .populate('notes.createdBy', 'name role')
      .select('-trackingTokenHash')
      .lean();
  }

  async update(user: AuthUser, id: string, dto: UpdateRepairTicketDto) {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can update ticket financial fields');
    }
    const ticket = await this.getScopedTicket(user.shopId, id);
    Object.assign(ticket, dto);
    this.recalculate(ticket);
    await ticket.save();
    const obj = ticket.toObject();
    delete (obj as { trackingTokenHash?: string }).trackingTokenHash;
    return obj;
  }

  async assignTechnician(user: AuthUser, id: string, dto: AssignTechnicianDto) {
    const tech = await this.userModel.findOne({
      _id: toObjectId(dto.technicianId),
      shopId: toObjectId(user.shopId),
      role: UserRole.TECHNICIAN,
      isActive: true,
    });
    if (!tech) throw new NotFoundException('Technician not found');

    const ticket = await this.getScopedTicket(user.shopId, id);
    ticket.technicianId = new Types.ObjectId(dto.technicianId);
    await ticket.save();

    await this.notifications.create({
      shopId: user.shopId,
      recipientId: dto.technicianId,
      type: NotificationType.TECHNICIAN_ASSIGNED,
      title: 'Repair assigned',
      message: `You were assigned to ticket ${ticket.ticketNumber}`,
      relatedTicketId: String(ticket._id),
    });

    const obj = ticket.toObject();
    delete (obj as { trackingTokenHash?: string }).trackingTokenHash;
    return obj;
  }

  async updateStatus(user: AuthUser, id: string, dto: UpdateRepairStatusDto, reopen = false) {
    const ticket = await this.getScopedTicket(user.shopId, id, user);
    this.statusTransition.assertTransition(ticket.status, dto.status, reopen);

    if (dto.status === RepairStatus.DELIVERED) {
      const shop = await this.shopModel.findById(user.shopId).lean();
      if (shop?.settings?.requirePaymentBeforeDelivery && ticket.outstandingBalance > 0.001) {
        throw new BadRequestException('Outstanding balance must be settled before delivery');
      }
    }

    if (user.role === UserRole.TECHNICIAN) {
      const allowed = [
        RepairStatus.DIAGNOSING,
        RepairStatus.WAITING_FOR_APPROVAL,
        RepairStatus.WAITING_FOR_PARTS,
        RepairStatus.IN_PROGRESS,
        RepairStatus.COMPLETED,
      ];
      if (!allowed.includes(dto.status)) {
        throw new ForbiddenException('Technicians cannot set this status');
      }
    }

    const previous = ticket.status;
    ticket.status = dto.status;
    ticket.statusHistory.push({
      previousStatus: previous,
      newStatus: dto.status,
      changedBy: new Types.ObjectId(user.userId),
      changedAt: new Date(),
      note: dto.note,
      customerVisible: dto.customerVisible ?? true,
    });

    if (dto.status === RepairStatus.COMPLETED) ticket.completedAt = new Date();
    if (dto.status === RepairStatus.DELIVERED) ticket.deliveredAt = new Date();

    await ticket.save();

    const adminIds = await this.getAdminIds(user.shopId);
    const typeMap: Partial<Record<RepairStatus, NotificationType>> = {
      [RepairStatus.WAITING_FOR_APPROVAL]: NotificationType.APPROVAL_REQUESTED,
      [RepairStatus.WAITING_FOR_PARTS]: NotificationType.PARTS_UNAVAILABLE,
      [RepairStatus.COMPLETED]: NotificationType.REPAIR_COMPLETED,
      [RepairStatus.READY_FOR_PICKUP]: NotificationType.READY_FOR_PICKUP,
    };
    const nType = typeMap[dto.status] || NotificationType.STATUS_CHANGED;
    await this.notifications.notifyShopAdmins(user.shopId, adminIds, {
      type: nType,
      title: `Ticket ${ticket.ticketNumber} → ${dto.status}`,
      message: dto.note || `Status changed to ${dto.status}`,
      relatedTicketId: String(ticket._id),
    });

    const obj = ticket.toObject();
    delete (obj as { trackingTokenHash?: string }).trackingTokenHash;
    return obj;
  }

  async addDiagnostics(user: AuthUser, id: string, dto: DiagnosticsDto) {
    const ticket = await this.getScopedTicket(user.shopId, id, user);
    ticket.diagnosticFindings = dto.diagnosticFindings;
    if (dto.estimatedCost !== undefined) ticket.estimatedCost = dto.estimatedCost;
    if (dto.laborCharge !== undefined) ticket.laborCharge = dto.laborCharge;
    this.recalculate(ticket);

    if (ticket.status === RepairStatus.RECEIVED) {
      const previous = ticket.status;
      ticket.status = RepairStatus.DIAGNOSING;
      ticket.statusHistory.push({
        previousStatus: previous,
        newStatus: RepairStatus.DIAGNOSING,
        changedBy: new Types.ObjectId(user.userId),
        changedAt: new Date(),
        note: 'Diagnostics recorded',
        customerVisible: true,
      });
    }

    await ticket.save();
    const adminIds = await this.getAdminIds(user.shopId);
    await this.notifications.notifyShopAdmins(user.shopId, adminIds, {
      type: NotificationType.DIAGNOSIS_COMPLETED,
      title: 'Diagnosis updated',
      message: `Diagnostics recorded for ${ticket.ticketNumber}`,
      relatedTicketId: String(ticket._id),
    });

    const obj = ticket.toObject();
    delete (obj as { trackingTokenHash?: string }).trackingTokenHash;
    return obj;
  }

  async addNote(user: AuthUser, id: string, dto: AddNoteDto) {
    const ticket = await this.getScopedTicket(user.shopId, id, user);
    ticket.notes.push({
      body: dto.body,
      createdBy: new Types.ObjectId(user.userId),
      customerVisible: !!dto.customerVisible,
      createdAt: new Date(),
    });
    await ticket.save();
    const obj = ticket.toObject();
    delete (obj as { trackingTokenHash?: string }).trackingTokenHash;
    return obj;
  }

  async addParts(user: AuthUser, id: string, dto: AddPartsDto) {
    const existingMovement = await this.movementModel
      .findOne({ shopId: toObjectId(user.shopId), idempotencyKey: dto.idempotencyKey })
      .lean();
    if (existingMovement) {
      const ticket = await this.ticketModel
        .findById(id)
        .select('-trackingTokenHash')
        .lean();
      return ticket;
    }

    const session = await this.connection.startSession();
    session.startTransaction();
    try {
      const ticket = await this.ticketModel
        .findOne({ _id: toObjectId(id), shopId: toObjectId(user.shopId) })
        .session(session);
      if (!ticket) throw new NotFoundException('Repair ticket not found');

      if (
        user.role === UserRole.TECHNICIAN &&
        ticket.technicianId &&
        String(ticket.technicianId) !== user.userId
      ) {
        throw new ForbiddenException('Not assigned to this ticket');
      }

      const already = ticket.partsUsed.find((p) => p.idempotencyKey === dto.idempotencyKey);
      if (already) {
        await session.abortTransaction();
        const obj = ticket.toObject();
        delete (obj as { trackingTokenHash?: string }).trackingTokenHash;
        return obj;
      }

      const item = await this.inventoryModel
        .findOne({ _id: toObjectId(dto.inventoryItemId), shopId: toObjectId(user.shopId) })
        .session(session);
      if (!item) throw new NotFoundException('Inventory item not found');
      if (item.quantity < dto.quantity) {
        throw new BadRequestException('Insufficient stock');
      }

      const updated = await this.inventoryModel.findOneAndUpdate(
        {
          _id: item._id,
          shopId: toObjectId(user.shopId),
          quantity: { $gte: dto.quantity },
        },
        { $inc: { quantity: -dto.quantity } },
        { new: true, session },
      );
      if (!updated) throw new BadRequestException('Insufficient stock');

      const unitPrice = roundMoney(item.sellingPrice);
      const lineTotal = roundMoney(unitPrice * dto.quantity);

      const [movement] = await this.movementModel.create(
        [
          {
            shopId: new Types.ObjectId(user.shopId),
            inventoryItemId: item._id,
            type: StockMovementType.CONSUMPTION,
            quantityChange: -dto.quantity,
            quantityAfter: updated.quantity,
            repairTicketId: ticket._id,
            unitCostSnapshot: unitPrice,
            createdBy: new Types.ObjectId(user.userId),
            note: `Used on ${ticket.ticketNumber}`,
            idempotencyKey: dto.idempotencyKey,
          },
        ],
        { session },
      );

      ticket.partsUsed.push({
        inventoryItemId: item._id,
        name: item.name,
        sku: item.sku,
        quantity: dto.quantity,
        unitPrice,
        lineTotal,
        idempotencyKey: dto.idempotencyKey,
        stockMovementId: movement._id,
        usedAt: new Date(),
      });
      this.recalculate(ticket);
      await ticket.save({ session });

      await session.commitTransaction();

      if (updated.quantity <= updated.lowStockThreshold) {
        const adminIds = await this.getAdminIds(user.shopId);
        await this.notifications.notifyShopAdmins(user.shopId, adminIds, {
          type: NotificationType.LOW_STOCK,
          title: 'Low stock alert',
          message: `${item.name} (${item.sku}) is low: ${updated.quantity} left`,
          relatedInventoryId: String(item._id),
        });
      }

      const obj = ticket.toObject();
      delete (obj as { trackingTokenHash?: string }).trackingTokenHash;
      return obj;
    } catch (err) {
      await session.abortTransaction();
      // Fallback for standalone MongoDB without transactions
      if (
        err instanceof Error &&
        /transaction|replica set|Transaction numbers/i.test(err.message)
      ) {
        return this.addPartsWithoutTransaction(user, id, dto);
      }
      throw err;
    } finally {
      session.endSession();
    }
  }

  private async addPartsWithoutTransaction(user: AuthUser, id: string, dto: AddPartsDto) {
    const ticket = await this.getScopedTicket(user.shopId, id, user);
    const already = ticket.partsUsed.find((p) => p.idempotencyKey === dto.idempotencyKey);
    if (already) {
      const obj = ticket.toObject();
      delete (obj as { trackingTokenHash?: string }).trackingTokenHash;
      return obj;
    }

    const updated = await this.inventoryModel.findOneAndUpdate(
      {
        _id: toObjectId(dto.inventoryItemId),
        shopId: toObjectId(user.shopId),
        quantity: { $gte: dto.quantity },
      },
      { $inc: { quantity: -dto.quantity } },
      { new: true },
    );
    if (!updated) throw new BadRequestException('Insufficient stock');

    const unitPrice = roundMoney(updated.sellingPrice);
    const lineTotal = roundMoney(unitPrice * dto.quantity);
    const movement = await this.movementModel.create({
      shopId: new Types.ObjectId(user.shopId),
      inventoryItemId: updated._id,
      type: StockMovementType.CONSUMPTION,
      quantityChange: -dto.quantity,
      quantityAfter: updated.quantity,
      repairTicketId: ticket._id,
      unitCostSnapshot: unitPrice,
      createdBy: new Types.ObjectId(user.userId),
      note: `Used on ${ticket.ticketNumber}`,
      idempotencyKey: dto.idempotencyKey,
    });

    ticket.partsUsed.push({
      inventoryItemId: updated._id,
      name: updated.name,
      sku: updated.sku,
      quantity: dto.quantity,
      unitPrice,
      lineTotal,
      idempotencyKey: dto.idempotencyKey,
      stockMovementId: movement._id,
      usedAt: new Date(),
    });
    this.recalculate(ticket);
    await ticket.save();
    const obj = ticket.toObject();
    delete (obj as { trackingTokenHash?: string }).trackingTokenHash;
    return obj;
  }

  async history(user: AuthUser, id: string) {
    const ticket = await this.getScopedTicket(user.shopId, id, user);
    return ticket.statusHistory;
  }

  async reopen(user: AuthUser, id: string, dto: UpdateRepairStatusDto) {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can reopen tickets');
    }
    return this.updateStatus(user, id, dto, true);
  }

  async publicTracking(token: string) {
    const hash = hashTrackingToken(token);
    const ticket = await this.ticketModel
      .findOne({ trackingTokenHash: hash })
      .populate('deviceId', 'category brand model')
      .populate('shopId', 'name phone address')
      .lean();
    if (!ticket) throw new NotFoundException('Tracking information not found');

    const shop = ticket.shopId as unknown as {
      name?: string;
      phone?: string;
      address?: string;
    };
    const device = ticket.deviceId as unknown as {
      category?: string;
      brand?: string;
      model?: string;
    };

    const timeline = (ticket.statusHistory || [])
      .filter((h) => h.customerVisible)
      .map((h) => ({
        status: h.newStatus,
        previousStatus: h.previousStatus,
        changedAt: h.changedAt,
        note: h.note,
      }));

    const customerNotes = (ticket.notes || [])
      .filter((n) => n.customerVisible)
      .map((n) => ({ body: n.body, createdAt: n.createdAt }));

    return {
      ticketNumber: ticket.ticketNumber,
      status: ticket.status,
      priority: ticket.priority,
      problemSummary: ticket.problemDescription,
      device: {
        category: device?.category,
        brand: device?.brand,
        model: device?.model,
      },
      estimatedCost: ticket.customerApproved
        ? ticket.approvedEstimate ?? ticket.estimatedCost
        : ticket.estimatedCost,
      finalCost:
        ticket.status === RepairStatus.COMPLETED ||
        ticket.status === RepairStatus.READY_FOR_PICKUP ||
        ticket.status === RepairStatus.DELIVERED
          ? ticket.total
          : undefined,
      paymentStatus: ticket.paymentStatus,
      outstandingBalance: ticket.outstandingBalance,
      readyForPickup: ticket.status === RepairStatus.READY_FOR_PICKUP,
      timeline,
      customerNotes,
      shop: {
        name: shop?.name,
        phone: shop?.phone,
        address: shop?.address,
        contactInstructions: shop?.phone
          ? `Call ${shop.phone} for questions about your repair.`
          : 'Contact the shop for questions about your repair.',
      },
    };
  }

  /** Used by payments module to refresh ticket financials */
  async applyPaymentTotals(
    shopId: string,
    ticketId: string,
    paidDelta: number,
    refundDelta = 0,
  ) {
    const ticket = await this.getScopedTicket(shopId, ticketId);
    ticket.totalPaid = roundMoney(ticket.totalPaid + paidDelta);
    ticket.refundedAmount = roundMoney(ticket.refundedAmount + refundDelta);
    this.recalculate(ticket);
    await ticket.save();
    return ticket;
  }
}
