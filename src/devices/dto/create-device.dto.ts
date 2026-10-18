import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsMongoId, IsOptional, IsString, MinLength } from 'class-validator';
import { DeviceCategory } from '../device.schema';

export class CreateDeviceDto {
  @ApiProperty()
  @IsMongoId()
  customerId!: string;

  @ApiProperty({ enum: DeviceCategory })
  @IsEnum(DeviceCategory)
  category!: DeviceCategory;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  brand!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  model!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serialOrImei?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  intakeCondition?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  accessories?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reportedProblem?: string;
}
