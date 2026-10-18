import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

class ShopSettingsDto {
  @IsOptional()
  @IsBoolean()
  requirePaymentBeforeDelivery?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultTaxRate?: number;

  @IsOptional()
  @IsString()
  receiptFooter?: string;
}

export class UpdateShopDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => ShopSettingsDto)
  settings?: ShopSettingsDto;
}
