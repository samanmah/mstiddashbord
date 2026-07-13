import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'editor' })
  @IsString()
  @MinLength(1, { message: 'نام کاربری الزامی است.' })
  @MaxLength(64)
  username!: string;

  @ApiProperty({ example: 'Editor@Passw0rd!' })
  @IsString()
  @MinLength(1, { message: 'رمز عبور الزامی است.' })
  @MaxLength(200)
  password!: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}
