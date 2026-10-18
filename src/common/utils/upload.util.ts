import { BadRequestException } from '@nestjs/common';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import type { Request } from 'express';

const onVercel = process.env.VERCEL === '1' || process.cwd() === '/var/task';
export const UPLOAD_ROOT = onVercel ? join('/tmp', 'uploads') : join(process.cwd(), 'uploads');

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
export const MAX_PHOTOS = 10;

export function ensureUploadDir(subdir: string) {
  const dir = join(UPLOAD_ROOT, subdir);
  try {
    if (!existsSync(UPLOAD_ROOT)) mkdirSync(UPLOAD_ROOT, { recursive: true });
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  } catch (err) {
    console.warn(`Could not create upload directory ${dir}`, err);
  }
  return dir;
}

export function buildPhotoUrl(subdir: string, filename: string) {
  return `/uploads/${subdir}/${filename}`;
}

export function getMulterOptions(subdir: string) {
  ensureUploadDir(subdir);
  return {
    storage: diskStorage({
      destination: (_req: Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
        cb(null, ensureUploadDir(subdir));
      },
      filename: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
        const ext = extname(file.originalname).toLowerCase() || '.jpg';
        cb(null, `${randomUUID()}${ext}`);
      },
    }),
    limits: { fileSize: MAX_FILE_SIZE, files: MAX_PHOTOS },
    fileFilter: (
      _req: Request,
      file: Express.Multer.File,
      cb: (error: Error | null, acceptFile: boolean) => void,
    ) => {
      if (!ALLOWED_MIME.has(file.mimetype)) {
        return cb(new BadRequestException('Only JPEG, PNG, WebP, or GIF images are allowed') as unknown as Error, false);
      }
      cb(null, true);
    },
  };
}

export function deleteUploadFile(photoUrl: string) {
  if (!photoUrl?.startsWith('/uploads/')) return;
  const relative = photoUrl.replace(/^\/uploads\//, '');
  const fullPath = join(UPLOAD_ROOT, relative);
  if (fullPath.startsWith(UPLOAD_ROOT) && existsSync(fullPath)) {
    try {
      unlinkSync(fullPath);
    } catch {
      // ignore missing files
    }
  }
}
