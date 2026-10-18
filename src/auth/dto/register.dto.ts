import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class RegisterShopDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  shopName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  shopPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  shopAddress?: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  ownerName!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'Password must contain at least one letter and one number',
  })
  password!: string;
}
