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
import { DevicesService } from './devices.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { QueryDevicesDto } from './dto/query-devices.dto';
import { RemoveDevicePhotoDto } from './dto/remove-device-photo.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';

@ApiTags('devices')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.TECHNICIAN)
@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Roles(UserRole.ADMIN)
  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateDeviceDto) {
    return { success: true, data: await this.devicesService.create(user.shopId, dto) };
  }

  @Get()
  async findAll(@CurrentUser() user: AuthUser, @Query() query: QueryDevicesDto) {
    const { items, meta } = await this.devicesService.findAll(user.shopId, query);
    return { success: true, data: items, meta };
  }

  @Get(':id')
  async findOne(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string) {
    return { success: true, data: await this.devicesService.findOne(user.shopId, id) };
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateDeviceDto,
  ) {
    return { success: true, data: await this.devicesService.update(user.shopId, id, dto) };
  }

  @Roles(UserRole.ADMIN)
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
  @UseInterceptors(FilesInterceptor('photos', MAX_PHOTOS, getMulterOptions('devices')))
  async uploadPhotos(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return { success: true, data: await this.devicesService.addPhotos(user.shopId, id, files) };
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id/photos')
  async removePhoto(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: RemoveDevicePhotoDto,
  ) {
    return { success: true, data: await this.devicesService.removePhoto(user.shopId, id, dto.url) };
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string) {
    return { success: true, data: await this.devicesService.remove(user.shopId, id) };
  }
}
