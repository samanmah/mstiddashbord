import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Probability, RiskLevel, VALIDATION } from '@ppm/contracts';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { IsOptionalJalaliDate } from '../../../common/validators/is-jalali-date.validator';

export class CreateRiskDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  rowNumber!: number;

  @ApiProperty()
  @IsString()
  @MinLength(1, { message: 'عنوان ریسک الزامی است.' })
  @MaxLength(VALIDATION.TITLE_MAX_LENGTH)
  title!: string;

  @ApiProperty({ enum: Probability })
  @IsEnum(Probability, { message: 'احتمال نامعتبر است.' })
  probability!: Probability;

  @ApiProperty({ enum: RiskLevel })
  @IsEnum(RiskLevel, { message: 'سطح ریسک نامعتبر است.' })
  riskLevel!: RiskLevel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(VALIDATION.DESCRIPTION_MAX_LENGTH)
  mitigationAction?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  owner?: string;

  @ApiPropertyOptional({ nullable: true, example: '1405/06/01' })
  @IsOptionalJalaliDate()
  dueDate?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  status?: string | null;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;
}

export class UpdateRiskDto extends PartialType(CreateRiskDto) {}
