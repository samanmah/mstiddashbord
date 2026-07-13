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

export class CreateIndicatorDto {
  @ApiProperty()
  @IsString()
  @MinLength(1, { message: 'عنوان شاخص الزامی است.' })
  @MaxLength(VALIDATION.TITLE_MAX_LENGTH)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  unit?: string | null;

  @ApiProperty()
  @IsNumber({}, { message: 'مقدار برنامه‌ای باید عدد باشد.' })
  plannedValue!: number;

  @ApiProperty()
  @IsNumber({}, { message: 'مقدار واقعی باید عدد باشد.' })
  actualValue!: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;
}

export class UpdateIndicatorDto extends PartialType(CreateIndicatorDto) {}
