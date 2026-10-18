import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { Connection, Model } from 'mongoose';
import slugify from 'slugify';
import { UserRole } from '../common/constants/roles';
import { MailService } from '../mail/mail.service';
import { Shop, ShopDocument } from '../shops/shop.schema';
import { User, UserDocument } from '../users/user.schema';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterShopDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Shop.name) private shopModel: Model<ShopDocument>,
    @InjectConnection() private connection: Connection,
    private jwtService: JwtService,
    private config: ConfigService,
    private mail: MailService,
  ) {}

  async register(dto: RegisterShopDto) {
    const existing = await this.userModel.findOne({ email: dto.email.toLowerCase() });
    if (existing) throw new ConflictException('Email already registered');

    const session = await this.connection.startSession();
    session.startTransaction();
    try {
      const baseSlug = slugify(dto.shopName, { lower: true, strict: true }) || 'shop';
      let slug = baseSlug;
      let i = 1;
      while (await this.shopModel.exists({ slug }).session(session)) {
        slug = `${baseSlug}-${i++}`;
      }

      const [shop] = await this.shopModel.create(
        [
          {
            name: dto.shopName,
            slug,
            phone: dto.shopPhone,
            address: dto.shopAddress,
            currency: this.config.get('defaultCurrency'),
            timezone: this.config.get('defaultTimezone'),
          },
        ],
        { session },
      );

      const passwordHash = await bcrypt.hash(dto.password, 12);
      const [user] = await this.userModel.create(
        [
          {
            name: dto.ownerName,
            email: dto.email.toLowerCase(),
            passwordHash,
            role: UserRole.ADMIN,
            shopId: shop._id,
            isActive: true,
          },
        ],
        { session },
      );

      shop.ownerId = user._id;
      await shop.save({ session });
      await session.commitTransaction();

      return this.buildAuthResponse(user, shop);
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  async login(dto: LoginDto) {
    const user = await this.userModel
      .findOne({ email: dto.email.toLowerCase() })
      .select('+passwordHash');
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid email or password');

    const shop = await this.shopModel.findById(user.shopId);
    if (!shop) throw new UnauthorizedException('Shop not found');

    return this.buildAuthResponse(user, shop);
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const generic = { message: 'If that email is registered, a reset link has been sent.' };
    const user = await this.userModel.findOne({ email: dto.email.toLowerCase() });
    if (!user || !user.isActive) return generic;

    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    user.passwordResetTokenHash = tokenHash;
    user.passwordResetExpires = new Date(Date.now() + 30 * 60 * 1000);
    await user.save();

    const frontend = (this.config.get<string>('frontendUrl') || 'http://localhost:5173').split(',')[0].trim();
    const resetUrl = `${frontend}/reset-password?token=${encodeURIComponent(token)}`;
    try {
      await this.mail.sendPasswordReset({ to: user.email, name: user.name, resetUrl });
    } catch (err) {
      this.logger.error(`Password reset email failed for ${user.email}`, err instanceof Error ? err.stack : err);
    }
    return generic;
  }

  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = createHash('sha256').update(dto.token).digest('hex');
    const user = await this.userModel.findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetExpires: { $gt: new Date() },
    });
    if (!user) throw new BadRequestException('Reset link is invalid or expired');

    await this.userModel.updateOne(
      { _id: user._id },
      {
        $set: { passwordHash: await bcrypt.hash(dto.password, 12) },
        $unset: { passwordResetTokenHash: 1, passwordResetExpires: 1 },
      },
    );
    return { message: 'Password updated. You can sign in.' };
  }

  async me(userId: string) {
    const user = await this.userModel.findById(userId).lean();
    if (!user) throw new UnauthorizedException();
    const shop = await this.shopModel.findById(user.shopId).lean();
    return {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      shopId: String(user.shopId),
      shop: shop
        ? {
            id: String(shop._id),
            name: shop.name,
            slug: shop.slug,
            phone: shop.phone,
            address: shop.address,
            currency: shop.currency,
            timezone: shop.timezone,
            settings: shop.settings,
          }
        : null,
    };
  }

  cookieOptions() {
    const crossSite = process.env.VERCEL === '1' || this.config.get<string>('nodeEnv') === 'production';
    return {
      httpOnly: true,
      secure: crossSite || this.config.get<boolean>('cookieSecure'),
      sameSite: crossSite
        ? 'none'
        : this.config.get<'lax' | 'strict' | 'none'>('cookieSameSite'),
      maxAge: 24 * 60 * 60 * 1000,
      path: '/',
    };
  }

  private buildAuthResponse(user: UserDocument, shop: ShopDocument) {
    const payload = {
      sub: String(user._id),
      email: user.email,
      role: user.role,
      shopId: String(user.shopId),
      name: user.name,
    };
    const accessToken = this.jwtService.sign(payload);
    return {
      accessToken,
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        role: user.role,
        shopId: String(user.shopId),
        shop: {
          id: String(shop._id),
          name: shop.name,
          slug: shop.slug,
          currency: shop.currency,
          timezone: shop.timezone,
        },
      },
    };
  }
}
