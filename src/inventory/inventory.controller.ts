import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/constants/roles';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { getMulterOptions, MAX_PHOTOS } from '../common/utils/upload.util';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { CreateStockMovementDto } from './dto/stock-movement.dto';
import { QueryInventoryDto } from './dto/query-inventory.dto';
import { RemoveInventoryPhotoDto } from './dto/remove-inventory-photo.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { InventoryService } from './inventory.service';

@ApiTags('inventory')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateInventoryDto) {
    return { success: true, data: await this.inventoryService.create(user.shopId, dto) };
  }

  @Get()
  async findAll(@CurrentUser() user: AuthUser, @Query() query: QueryInventoryDto) {
    const { items, meta } = await this.inventoryService.findAll(user.shopId, query);
    return { success: true, data: items, meta };
  }

  @Get('low-stock')
  async lowStock(@CurrentUser() user: AuthUser) {
    return { success: true, data: await this.inventoryService.lowStock(user.shopId) };
  }

  @Get(':id')
  async findOne(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string) {
    return { success: true, data: await this.inventoryService.findOne(user.shopId, id) };
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateInventoryDto,
  ) {
    return { success: true, data: await this.inventoryService.update(user.shopId, id, dto) };
  }

  @Post(':id/photos')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        photos: { type: 'array', items: { type: 'string', format: 'binary' } },
      },
    },
  })
  @UseInterceptors(FilesInterceptor('photos', MAX_PHOTOS, getMulterOptions('inventory')))
  async uploadPhotos(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return { success: true, data: await this.inventoryService.addPhotos(user.shopId, id, files) };
  }

  @Delete(':id/photos')
  async removePhoto(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: RemoveInventoryPhotoDto,
  ) {
    return {
      success: true,
      data: await this.inventoryService.removePhoto(user.shopId, id, dto.url),
    };
  }

  @Post(':id/stock-movements')
  async addMovement(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: CreateStockMovementDto,
  ) {
    return {
      success: true,
      data: await this.inventoryService.addMovement(user.shopId, user.userId, id, dto),
    };
  }

  @Get(':id/stock-movements')
  async listMovements(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string) {
    return { success: true, data: await this.inventoryService.listMovements(user.shopId, id) };
  }
}
