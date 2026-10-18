import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { toObjectId } from '../common/utils/object-id.util';
import { normalizePhone } from '../common/utils/phone.util';
import { RepairTicket, RepairTicketDocument } from '../repair-tickets/repair-ticket.schema';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { QueryCustomersDto } from './dto/query-customers.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { Customer, CustomerDocument } from './customer.schema';

@Injectable()
export class CustomersService {
  constructor(
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
    @InjectModel(RepairTicket.name) private ticketModel: Model<RepairTicketDocument>,
  ) {}

  async create(shopId: string, dto: CreateCustomerDto) {
    const phoneNormalized = normalizePhone(dto.phone);
    const exists = await this.customerModel.findOne({ shopId: toObjectId(shopId), phoneNormalized });
    if (exists) throw new ConflictException('Customer with this phone already exists');

    const customer = await this.customerModel.create({
      ...dto,
      phoneNormalized,
      shopId: new Types.ObjectId(shopId),
    });
    return customer.toObject();
  }

  async findAll(shopId: string, query: QueryCustomersDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const filter: Record<string, unknown> = { shopId: new Types.ObjectId(shopId) };
    if (query.search) {
      const rx = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: rx }, { phone: rx }, { email: rx }, { phoneNormalized: rx }];
    }
    const [items, total] = await Promise.all([
      this.customerModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.customerModel.countDocuments(filter),
    ]);
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(shopId: string, id: string) {
    const customer = await this.customerModel
      .findOne({ _id: toObjectId(id), shopId: toObjectId(shopId) })
      .lean();
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async update(shopId: string, id: string, dto: UpdateCustomerDto) {
    const update: Record<string, unknown> = { ...dto };
    if (dto.phone) {
      update.phoneNormalized = normalizePhone(dto.phone);
      const exists = await this.customerModel.findOne({
        shopId: toObjectId(shopId),
        phoneNormalized: update.phoneNormalized,
        _id: { $ne: toObjectId(id) },
      });
      if (exists) throw new ConflictException('Customer with this phone already exists');
    }
    const customer = await this.customerModel
      .findOneAndUpdate({ _id: toObjectId(id), shopId: toObjectId(shopId) }, { $set: update }, { new: true })
      .lean();
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async remove(shopId: string, id: string) {
    const result = await this.customerModel.findOneAndDelete({ _id: toObjectId(id), shopId: toObjectId(shopId) });
    if (!result) throw new NotFoundException('Customer not found');
    return { deleted: true };
  }

  async repairHistory(shopId: string, id: string) {
    await this.findOne(shopId, id);
    const tickets = await this.ticketModel
      .find({ shopId: new Types.ObjectId(shopId), customerId: new Types.ObjectId(id) })
      .sort({ createdAt: -1 })
      .select('-trackingTokenHash')
      .lean();
    const totalRepairs = tickets.length;
    const outstandingBalance = tickets.reduce((sum, t) => sum + (t.outstandingBalance || 0), 0);
    return { tickets, totalRepairs, outstandingBalance };
  }
}
