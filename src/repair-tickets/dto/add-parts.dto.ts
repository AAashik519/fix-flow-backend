import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsMongoId, IsString, Min, MinLength } from 'class-validator';

export class AddPartsDto {
  @ApiProperty()
  @IsMongoId()
  inventoryItemId!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  idempotencyKey!: string;
}
