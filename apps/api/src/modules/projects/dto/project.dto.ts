import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { VALIDATION } from '@ppm/contracts';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { IsJalaliDate } from '../../../common/validators/is-jalali-date.validator';

export class CreateProjectDto {
  @ApiProperty()
  @IsString()
  @MinLength(1, { message: 'عنوان فارسی الزامی است.' })
  @MaxLength(VALIDATION.TITLE_MAX_LENGTH)
  titleFa!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(VALIDATION.TITLE_MAX_LENGTH)
  titleEn?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  projectCode?: string | null;

  @ApiProperty()
  @IsString()
  @MinLength(1, { message: 'مسئول پروژه الزامی است.' })
  @MaxLength(200)
  projectManager!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1, { message: 'نوع پروژه الزامی است.' })
  @MaxLength(200)
  projectType!: string;

  @ApiProperty()
  @IsNumber({}, { message: 'بودجه باید عدد باشد.' })
  @Min(0, { message: 'بودجه باید عدد مثبت باشد.' })
  budgetBillionRial!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(VALIDATION.DESCRIPTION_MAX_LENGTH)
  description?: string;

  @ApiProperty({ example: '1405/04/01' })
  @IsJalaliDate()
  startDate!: string;

  @ApiProperty({ example: '1406/06/01' })
  @IsJalaliDate()
  plannedEndDate!: string;

  @ApiProperty({ example: '1405/03/23' })
  @IsJalaliDate()
  reportDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  logoUrl?: string | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateProjectDto extends PartialType(CreateProjectDto) {
  @ApiProperty({ description: 'نسخه فعلی برای کنترل هم‌زمانی (Optimistic Concurrency)' })
  @IsInt()
  @Min(0)
  version!: number;
}
