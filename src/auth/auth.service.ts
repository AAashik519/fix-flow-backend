import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Connection, Model } from 'mongoose';
import slugify from 'slugify';
import { UserRole } from '../common/constants/roles';
import { Shop, ShopDocument } from '../shops/shop.schema';
import { User, UserDocument } from '../users/user.schema';
import { LoginDto } from './dto/login.dto';
import { RegisterShopDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Shop.name) private shopModel: Model<ShopDocument>,
    @InjectConnection() private connection: Connection,
    private jwtService: JwtService,
    private config: ConfigService,
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
    const isProduction = this.config.get<string>('nodeEnv') === 'production';
    return {
      httpOnly: true,
      secure: isProduction || this.config.get<boolean>('cookieSecure'),
      sameSite: isProduction
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
