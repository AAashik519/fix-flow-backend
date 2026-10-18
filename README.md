# FixFlow backend

NestJS API for FixFlow. It stores shops, users, customers, devices, repair tickets, inventory, payments, and notifications in MongoDB.

Live API: https://fix-flow-backend.vercel.app/api/v1

Swagger: https://fix-flow-backend.vercel.app/api/docs

## Stack

- NestJS 10, TypeScript
- MongoDB and Mongoose
- JWT in an HTTP-only cookie, plus a bearer token for cross-site frontends
- class-validator
- Helmet, throttling
- Nodemailer

## Requirements

- Node.js 20+
- MongoDB (local, or Atlas)

## Setup

```bash
cd backend
npm install
cp .env.example .env
npm run start:dev
```

API base: http://localhost:5000/api/v1

Health: http://localhost:5000/api/v1/health

## Environment

Copy `backend/.env.example` to `backend/.env`. Do not commit real secrets.

| Variable | Purpose |
| --- | --- |
| `PORT` | API port. Default `5000` |
| `FRONTEND_URL` | First URL is used in password-reset emails. Comma-separated origins are accepted |
| `MONGODB_URI` | Mongo connection string |
| `JWT_SECRET` | At least 16 characters |
| `JWT_EXPIRES_IN` | Token lifetime. Default `1d` |
| `COOKIE_SECURE` | `true` on HTTPS |
| `COOKIE_SAME_SITE` | `lax` locally. Production and Vercel use `none` so the cookie can cross sites |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Gmail or another SMTP server for tracking links and password reset |

Gmail needs an App Password, not the normal account password. `SMTP_USER` and the address inside `SMTP_FROM` should be the same mailbox.

On Vercel set `FRONTEND_URL` to the live UI, for example `https://fix-flow-frontend-orpin.vercel.app`, so reset emails do not point at localhost.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run start:dev` | Watch mode |
| `npm run build` | Compile to `dist/` |
| `npm run start:prod` | Run `dist/main` |
| `npm test` | Unit tests |
| `npm run test:e2e` | API flow test |
| `npm run seed` | Demo shop, admin, technician, customer, and ticket |
| `npm run lint` | ESLint |

Seed logins (development only):

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@fixflow.local` | `Admin123!` |
| Technician | `tech@fixflow.local` | `Tech123!` |

The seed script prints a public tracking URL.

## Auth

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/auth/reset-password`

Login sets an HTTP-only `access_token` cookie and also returns `accessToken`. The deployed frontend sends that token as `Authorization: Bearer`, because a cookie set on `fix-flow-backend.vercel.app` is not sent from `fix-flow-frontend-orpin.vercel.app`.

Forgot-password always answers the same way, whether or not the email exists. The reset link expires in 30 minutes and can be used once. Passwords need at least 8 characters, including a letter and a number.

## Other resources

All routes are under `/api/v1`.

- Customers, devices, technicians, inventory, payments, notifications, shops
- Repair tickets: create, assign, status, diagnostics, notes, parts, history, reopen
- `GET /api/v1/public/tracking/:trackingToken` is public
- Dashboard and reports

Roles are `ADMIN` and `TECHNICIAN`. Queries are limited to the signed-in user's `shopId`.

Repair total is `labor + parts - discount + tax`. Estimated cost is a quote and is not added into that total. Delivery can be blocked while an outstanding balance remains (`requirePaymentBeforeDelivery` on the shop).

Creating a ticket emails the customer a tracking link when SMTP is configured. The database stores only a hash of the tracking token.

## CORS and Vercel

CORS reflects the request origin and allows credentials, so the Vercel frontend can call this API.

Photo upload folders are created under `/tmp/uploads` when `VERCEL=1`. `/var/task` is read-only, and creating `uploads` there crashes the function before CORS headers are sent.

Redeploy this service after backend changes. Opening `/api/v1/auth/me` directly in the browser returns 401 unless a bearer token or cookie is sent.

## Tests

```bash
npm test
npm run test:e2e
```

Unit tests cover money totals and repair status transitions. The e2e test walks registration through ticket, parts, payment, and public tracking, and checks that one shop cannot read another shop's data.
