import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { ActivityStatus, VALIDATION } from '@ppm/contracts';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { IsJalaliDate } from '../../../common/validators/is-jalali-date.validator';

export class CreateActivityDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  rowNumber!: number;

  @ApiProperty()
  @IsString()
  @MinLength(1, { message: 'عنوان فعالیت الزامی است.' })
  @MaxLength(VALIDATION.TITLE_MAX_LENGTH)
  title!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(100)
  weightPercent!: number;

  @ApiProperty({ example: '1405/04/01' })
  @IsJalaliDate()
  startDate!: string;

  @ApiProperty({ example: '1405/06/31' })
  @IsJalaliDate()
  endDate!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(100)
  plannedPercent!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(100)
  actualPercent!: number;

  @ApiPropertyOptional({ enum: ActivityStatus, nullable: true })
  @IsOptional()
  @IsEnum(ActivityStatus)
  statusOverride?: ActivityStatus | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;
}

export class UpdateActivityDto extends PartialType(CreateActivityDto) {}

export class BulkActivitiesDto {
  @ApiProperty({ type: [CreateActivityDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateActivityDto)
  items!: CreateActivityDto[];
}
