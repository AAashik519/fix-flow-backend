import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model, Types } from 'mongoose';
import { toObjectId } from '../common/utils/object-id.util';
import { UserRole } from '../common/constants/roles';
import { RepairTicket, RepairTicketDocument } from '../repair-tickets/repair-ticket.schema';
import { User, UserDocument } from '../users/user.schema';
import { CreateTechnicianDto } from './dto/create-technician.dto';
import { UpdateTechnicianDto } from './dto/update-technician.dto';

@Injectable()
export class TechniciansService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(RepairTicket.name) private ticketModel: Model<RepairTicketDocument>,
  ) {}

  async create(shopId: string, dto: CreateTechnicianDto) {
    const exists = await this.userModel.findOne({ email: dto.email.toLowerCase() });
    if (exists) throw new ConflictException('Email already registered');
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const tech = await this.userModel.create({
      name: dto.name,
      email: dto.email.toLowerCase(),
      passwordHash,
      role: UserRole.TECHNICIAN,
      shopId: new Types.ObjectId(shopId),
      isActive: true,
    });
    const obj = tech.toObject();
    delete (obj as { passwordHash?: string }).passwordHash;
    return obj;
  }

  async findAll(shopId: string) {
    return this.userModel
      .find({ shopId: toObjectId(shopId), role: UserRole.TECHNICIAN })
      .sort({ name: 1 })
      .lean();
  }

  async findOne(shopId: string, id: string) {
    const tech = await this.userModel
      .findOne({ _id: toObjectId(id), shopId: toObjectId(shopId), role: UserRole.TECHNICIAN })
      .lean();
    if (!tech) throw new NotFoundException('Technician not found');
    return tech;
  }

  async update(shopId: string, id: string, dto: UpdateTechnicianDto) {
    const tech = await this.userModel
      .findOneAndUpdate({ _id: toObjectId(id), shopId: toObjectId(shopId), role: UserRole.TECHNICIAN }, { $set: dto }, { new: true })
      .lean();
    if (!tech) throw new NotFoundException('Technician not found');
    return tech;
  }

  async assignments(shopId: string, id: string) {
    await this.findOne(shopId, id);
    return this.ticketModel
      .find({ shopId: new Types.ObjectId(shopId), technicianId: new Types.ObjectId(id) })
      .sort({ updatedAt: -1 })
      .select('-trackingTokenHash')
      .lean();
  }
}
