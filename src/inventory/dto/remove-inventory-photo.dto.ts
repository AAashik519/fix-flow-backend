import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class RemoveInventoryPhotoDto {
  @ApiProperty({ example: '/uploads/inventory/abc.jpg' })
  @IsString()
  @MinLength(1)
  url!: string;
}
