import { createHash, randomBytes } from 'crypto';

export function generateTrackingToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashTrackingToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
