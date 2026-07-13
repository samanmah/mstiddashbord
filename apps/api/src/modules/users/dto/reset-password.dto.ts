import { ApiProperty } from '@nestjs/swagger';
import { VALIDATION } from '@ppm/contracts';
import { IsBoolean, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ minLength: VALIDATION.PASSWORD_MIN_LENGTH })
  @IsString()
  @MinLength(VALIDATION.PASSWORD_MIN_LENGTH, {
    message: `رمز عبور باید حداقل ${VALIDATION.PASSWORD_MIN_LENGTH} کاراکتر باشد.`,
  })
  @MaxLength(200)
  @Matches(/[A-Z]/, { message: 'رمز عبور باید حرف بزرگ داشته باشد.' })
  @Matches(/[a-z]/, { message: 'رمز عبور باید حرف کوچک داشته باشد.' })
  @Matches(/[0-9]/, { message: 'رمز عبور باید عدد داشته باشد.' })
  @Matches(/[^A-Za-z0-9]/, { message: 'رمز عبور باید علامت ویژه داشته باشد.' })
  newPassword!: string;
}

export class UpdateStatusDto {
  @ApiProperty()
  @IsBoolean()
  isActive!: boolean;
}
