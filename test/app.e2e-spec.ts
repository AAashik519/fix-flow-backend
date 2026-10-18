import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { RepairStatus } from '../src/common/constants/repair-status';

describe('FixFlow E2E', () => {
  let app: INestApplication;
  let adminCookie = '';
  let otherAdminCookie = '';
  let trackingToken = '';
  let customerId = '';
  let deviceId = '';
  let ticketId = '';
  let techId = '';
  let inventoryId = '';

  const suffix = Date.now();

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_key_123456';
    process.env.FRONTEND_URL = 'http://localhost:5173';
    process.env.COOKIE_SECURE = 'false';
    process.env.COOKIE_SAME_SITE = 'lax';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await mongoose.disconnect();
  });

  it('health check', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(res.body.success).toBe(true);
  });

  it('registers shop and admin', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        shopName: `E2E Shop ${suffix}`,
        ownerName: 'E2E Admin',
        email: `admin${suffix}@example.com`,
        password: 'Admin123!',
      })
      .expect(201);

    expect(res.body.data.user.role).toBe('ADMIN');
    adminCookie = res.headers['set-cookie']?.[0] || '';
    expect(adminCookie).toContain('access_token');
  });

  it('registers second shop for isolation', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        shopName: `Other Shop ${suffix}`,
        ownerName: 'Other Admin',
        email: `other${suffix}@example.com`,
        password: 'Admin123!',
      })
      .expect(201);
    otherAdminCookie = res.headers['set-cookie']?.[0] || '';
  });

  it('creates technician, customer, device, inventory', async () => {
    const tech = await request(app.getHttpServer())
      .post('/api/v1/technicians')
      .set('Cookie', adminCookie)
      .send({
        name: 'E2E Tech',
        email: `tech${suffix}@example.com`,
        password: 'Tech123!',
      })
      .expect(201);
    techId = tech.body.data._id;

    const customer = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set('Cookie', adminCookie)
      .send({
        name: 'Test Customer',
        phone: `0171${String(suffix).slice(-7)}`,
        email: `cust${suffix}@example.com`,
      })
      .expect(201);
    customerId = customer.body.data._id;

    const device = await request(app.getHttpServer())
      .post('/api/v1/devices')
      .set('Cookie', adminCookie)
      .send({
        customerId,
        category: 'MOBILE',
        brand: 'Xiaomi',
        model: 'Redmi Note',
        reportedProblem: 'No power',
      })
      .expect(201);
    deviceId = device.body.data._id;

    const inv = await request(app.getHttpServer())
      .post('/api/v1/inventory')
      .set('Cookie', adminCookie)
      .send({
        name: 'Battery Pack',
        sku: `BAT-${suffix}`,
        category: 'Battery',
        purchaseCost: 500,
        sellingPrice: 1200,
        quantity: 5,
        lowStockThreshold: 1,
      })
      .expect(201);
    inventoryId = inv.body.data._id;
  });

  it('creates ticket, assigns tech, diagnostics, parts, completes, pays, ready', async () => {
    const ticket = await request(app.getHttpServer())
      .post('/api/v1/repair-tickets')
      .set('Cookie', adminCookie)
      .send({
        customerId,
        deviceId,
        problemDescription: 'Device does not power on',
        estimatedCost: 2000,
        laborCharge: 500,
      })
      .expect(201);

    ticketId = ticket.body.data._id;
    trackingToken = ticket.body.data.trackingToken;
    expect(trackingToken).toBeTruthy();

    await request(app.getHttpServer())
      .patch(`/api/v1/repair-tickets/${ticketId}/assign-technician`)
      .set('Cookie', adminCookie)
      .send({ technicianId: techId })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/repair-tickets/${ticketId}/diagnostics`)
      .set('Cookie', adminCookie)
      .send({ diagnosticFindings: 'Battery swollen', estimatedCost: 2000, laborCharge: 500 })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/v1/repair-tickets/${ticketId}/status`)
      .set('Cookie', adminCookie)
      .send({ status: RepairStatus.IN_PROGRESS })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/repair-tickets/${ticketId}/parts`)
      .set('Cookie', adminCookie)
      .send({
        inventoryItemId: inventoryId,
        quantity: 1,
        idempotencyKey: `idem-part-${suffix}`,
      })
      .expect(201);

    // duplicate parts request should not double-consume
    await request(app.getHttpServer())
      .post(`/api/v1/repair-tickets/${ticketId}/parts`)
      .set('Cookie', adminCookie)
      .send({
        inventoryItemId: inventoryId,
        quantity: 1,
        idempotencyKey: `idem-part-${suffix}`,
      })
      .expect(201);

    const invAfter = await request(app.getHttpServer())
      .get(`/api/v1/inventory/${inventoryId}`)
      .set('Cookie', adminCookie)
      .expect(200);
    expect(invAfter.body.data.quantity).toBe(4);

    await request(app.getHttpServer())
      .patch(`/api/v1/repair-tickets/${ticketId}/status`)
      .set('Cookie', adminCookie)
      .send({ status: RepairStatus.COMPLETED })
      .expect(200);

    const pay = await request(app.getHttpServer())
      .post('/api/v1/payments')
      .set('Cookie', adminCookie)
      .send({
        repairTicketId: ticketId,
        amount: 500,
        method: 'CASH',
        idempotencyKey: `idem-pay-${suffix}`,
      })
      .expect(201);
    expect(pay.body.data.amount).toBe(500);

    const details = await request(app.getHttpServer())
      .get(`/api/v1/repair-tickets/${ticketId}`)
      .set('Cookie', adminCookie)
      .expect(200);
    expect(details.body.data.outstandingBalance).toBeGreaterThan(0);
    expect(details.body.data.paymentStatus).toBe('PARTIALLY_PAID');

    await request(app.getHttpServer())
      .patch(`/api/v1/repair-tickets/${ticketId}/status`)
      .set('Cookie', adminCookie)
      .send({ status: RepairStatus.READY_FOR_PICKUP })
      .expect(200);
  });

  it('public tracking hides internal fields', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/public/tracking/${trackingToken}`)
      .expect(200);

    expect(res.body.data.ticketNumber).toBeTruthy();
    expect(res.body.data.status).toBe(RepairStatus.READY_FOR_PICKUP);
    expect(res.body.data.shopId).toBeUndefined();
    expect(res.body.data.trackingTokenHash).toBeUndefined();
    expect(res.body.data.notes).toBeUndefined();
    expect(res.body.data.internalNotes).toBeUndefined();
  });

  it('prevents cross-shop access', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/customers/${customerId}`)
      .set('Cookie', otherAdminCookie)
      .expect(404);

    await request(app.getHttpServer())
      .get(`/api/v1/repair-tickets/${ticketId}`)
      .set('Cookie', otherAdminCookie)
      .expect(404);
  });

  it('rejects invalid status transition', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/repair-tickets/${ticketId}/status`)
      .set('Cookie', adminCookie)
      .send({ status: RepairStatus.DIAGNOSING })
      .expect(400);
  });
});
