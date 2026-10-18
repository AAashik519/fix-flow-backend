import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model, Types } from 'mongoose';
import { AppModule } from '../app.module';
import { UserRole } from '../common/constants/roles';
import { RepairStatus } from '../common/constants/repair-status';
import { normalizePhone } from '../common/utils/phone.util';
import {
  generateTrackingToken,
  hashTrackingToken,
} from '../common/utils/tracking-token.util';
import {
  calculateRepairTotals,
  deriveTicketPaymentStatus,
} from '../common/utils/money.util';
import { TicketPaymentStatus } from '../common/constants/payment';
import { Customer } from '../customers/customer.schema';
import { Device, DeviceCategory } from '../devices/device.schema';
import { InventoryItem } from '../inventory/inventory-item.schema';
import { RepairTicket, RepairPriority } from '../repair-tickets/repair-ticket.schema';
import { Shop } from '../shops/shop.schema';
import { User } from '../users/user.schema';

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const shopModel = app.get<Model<Shop>>(getModelToken(Shop.name));
  const userModel = app.get<Model<User>>(getModelToken(User.name));
  const customerModel = app.get<Model<Customer>>(getModelToken(Customer.name));
  const deviceModel = app.get<Model<Device>>(getModelToken(Device.name));
  const inventoryModel = app.get<Model<InventoryItem>>(getModelToken(InventoryItem.name));
  const ticketModel = app.get<Model<RepairTicket>>(getModelToken(RepairTicket.name));

  console.log('Clearing existing demo data for seed shop...');
  const existing = await shopModel.findOne({ slug: 'demo-fixflow' });
  if (existing) {
    const shopId = existing._id;
    await Promise.all([
      ticketModel.deleteMany({ shopId }),
      inventoryModel.deleteMany({ shopId }),
      deviceModel.deleteMany({ shopId }),
      customerModel.deleteMany({ shopId }),
      userModel.deleteMany({ shopId }),
      shopModel.deleteOne({ _id: shopId }),
    ]);
  }

  const shop = await shopModel.create({
    name: 'Demo FixFlow Shop',
    slug: 'demo-fixflow',
    phone: '+8801700000000',
    address: 'Dhaka, Bangladesh',
    currency: 'BDT',
    timezone: 'Asia/Dhaka',
  });

  const adminHash = await bcrypt.hash('Admin123!', 12);
  const techHash = await bcrypt.hash('Tech123!', 12);

  const admin = await userModel.create({
    name: 'Demo Admin',
    email: 'admin@fixflow.local',
    passwordHash: adminHash,
    role: UserRole.ADMIN,
    shopId: shop._id,
    isActive: true,
  });
  shop.ownerId = admin._id as Types.ObjectId;
  await shop.save();

  const technician = await userModel.create({
    name: 'Demo Technician',
    email: 'tech@fixflow.local',
    passwordHash: techHash,
    role: UserRole.TECHNICIAN,
    shopId: shop._id,
    isActive: true,
  });

  const customer = await customerModel.create({
    shopId: shop._id,
    name: 'Karim Hasan',
    phone: '01711112222',
    phoneNormalized: normalizePhone('01711112222'),
    email: 'karim@example.com',
    address: 'Mirpur, Dhaka',
    notes: 'VIP customer',
  });

  const device = await deviceModel.create({
    shopId: shop._id,
    customerId: customer._id,
    category: DeviceCategory.MOBILE,
    brand: 'Samsung',
    model: 'Galaxy A54',
    serialOrImei: '359632100000001',
    intakeCondition: 'Cracked screen, powers on',
    accessories: ['Charger'],
    reportedProblem: 'Broken display',
  });

  const screen = await inventoryModel.create({
    shopId: shop._id,
    name: 'A54 Display Assembly',
    sku: 'SCR-A54',
    category: 'Display',
    brand: 'Samsung',
    purchaseCost: 2500,
    sellingPrice: 4500,
    quantity: 8,
    lowStockThreshold: 2,
    supplierName: 'Parts Hub BD',
  });

  await inventoryModel.create({
    shopId: shop._id,
    name: 'USB-C Charging Port',
    sku: 'PRT-USBC',
    category: 'Port',
    purchaseCost: 200,
    sellingPrice: 600,
    quantity: 3,
    lowStockThreshold: 5,
  });

  const trackingToken = generateTrackingToken();
  const laborCharge = 800;
  const partsSubtotal = 4500;
  const totals = calculateRepairTotals({
    partsSubtotal,
    laborCharge,
    discount: 0,
    tax: 0,
    totalPaid: 2000,
  });

  await ticketModel.create({
    shopId: shop._id,
    ticketNumber: 'FF-SEED-0001',
    customerId: customer._id,
    deviceId: device._id,
    problemDescription: 'Broken display after drop',
    diagnosticFindings: 'LCD and digitizer need replacement',
    technicianId: technician._id,
    priority: RepairPriority.HIGH,
    status: RepairStatus.IN_PROGRESS,
    estimatedCost: 5300,
    ...totals,
    paymentStatus: deriveTicketPaymentStatus(
      totals.total,
      totals.totalPaid,
    ) as TicketPaymentStatus,
    depositAmount: 2000,
    partsUsed: [
      {
        inventoryItemId: screen._id,
        name: screen.name,
        sku: screen.sku,
        quantity: 1,
        unitPrice: screen.sellingPrice,
        lineTotal: screen.sellingPrice,
        idempotencyKey: 'seed-part-1',
        usedAt: new Date(),
      },
    ],
    trackingTokenHash: hashTrackingToken(trackingToken),
    statusHistory: [
      {
        previousStatus: RepairStatus.RECEIVED,
        newStatus: RepairStatus.RECEIVED,
        changedBy: admin._id,
        changedAt: new Date(),
        note: 'Seed ticket created',
        customerVisible: true,
      },
      {
        previousStatus: RepairStatus.RECEIVED,
        newStatus: RepairStatus.IN_PROGRESS,
        changedBy: technician._id,
        changedAt: new Date(),
        note: 'Repair started',
        customerVisible: true,
      },
    ],
    notes: [
      {
        body: 'Customer approved estimate verbally',
        createdBy: admin._id,
        customerVisible: true,
        createdAt: new Date(),
      },
    ],
    customerApproved: true,
    approvedEstimate: 5300,
  });

  console.log('\nSeed complete (local development only)\n');
  console.log('Admin:      admin@fixflow.local / Admin123!');
  console.log('Technician: tech@fixflow.local / Tech123!');
  console.log('Tracking token:', trackingToken);
  console.log('Track URL: http://localhost:5173/track/' + trackingToken);

  await app.close();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
