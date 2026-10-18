import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser, @Query('unreadOnly') unreadOnly?: string) {
    const data = await this.notificationsService.findForUser(
      user.shopId,
      user.userId,
      unreadOnly === 'true',
    );
    return { success: true, data };
  }

  @Patch('read-all')
  async readAll(@CurrentUser() user: AuthUser) {
    return {
      success: true,
      data: await this.notificationsService.markAllRead(user.shopId, user.userId),
    };
  }

  @Patch(':id/read')
  async readOne(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string) {
    return {
      success: true,
      data: await this.notificationsService.markRead(user.shopId, user.userId, id),
    };
  }
}
