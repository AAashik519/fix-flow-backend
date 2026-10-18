import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { StockMovementType } from '../stock-movement.schema';

export class CreateStockMovementDto {
  @ApiProperty({ enum: [StockMovementType.PURCHASE, StockMovementType.ADJUSTMENT, StockMovementType.RETURN] })
  @IsEnum(StockMovementType)
  type!: StockMovementType;

  @ApiProperty({ description: 'Positive for stock in, negative for adjustment out' })
  @IsInt()
  quantityChange!: number;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  idempotencyKey!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
