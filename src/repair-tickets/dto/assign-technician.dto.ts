import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId } from 'class-validator';

export class AssignTechnicianDto {
  @ApiProperty()
  @IsMongoId()
  technicianId!: string;
}
