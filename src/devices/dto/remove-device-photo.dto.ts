import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class RemoveDevicePhotoDto {
  @ApiProperty({ example: '/uploads/devices/abc.jpg' })
  @IsString()
  @MinLength(1)
  url!: string;
}
