import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@ppm/contracts';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'نام کامل الزامی است.' })
  @MaxLength(200)
  fullName?: string;

  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole, { message: 'نقش نامعتبر است.' })
  role?: UserRole;
}
