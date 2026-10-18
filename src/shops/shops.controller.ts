import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/constants/roles';
import { UpdateShopDto } from './dto/update-shop.dto';
import { ShopsService } from './shops.service';

@ApiTags('shops')
@ApiBearerAuth()
@Controller('shops')
export class ShopsController {
  constructor(private readonly shopsService: ShopsService) {}

  @Get('me')
  async getMine(@CurrentUser() user: AuthUser) {
    const data = await this.shopsService.getMine(user.shopId);
    return { success: true, data };
  }

  @Roles(UserRole.ADMIN)
  @Patch('me')
  async update(@CurrentUser() user: AuthUser, @Body() dto: UpdateShopDto) {
    const data = await this.shopsService.update(user.shopId, dto);
    return { success: true, data };
  }
}
