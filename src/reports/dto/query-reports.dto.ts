import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional } from 'class-validator';

export class QueryReportsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ enum: ['repairs', 'payments', 'inventory', 'technicians'] })
  @IsOptional()
  @IsIn(['repairs', 'payments', 'inventory', 'technicians'])
  type?: string;
}
