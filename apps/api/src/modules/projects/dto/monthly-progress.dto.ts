import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreateMonthlyProgressDto {
  @ApiProperty({ example: 1405 })
  @IsInt()
  @Min(1300)
  @Max(1500)
  jalaliYear!: number;

  @ApiProperty({ example: 4 })
  @IsInt()
  @Min(1)
  @Max(12)
  jalaliMonth!: number;

  @ApiProperty({ example: 'تیر (1405)' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  monthLabel!: string;

  @ApiProperty({ example: 5 })
  @IsNumber()
  @Min(0)
  @Max(100)
  plannedPercent!: number;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  actualPercent?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}

export class UpdateMonthlyProgressDto extends PartialType(CreateMonthlyProgressDto) {}

export class BulkMonthlyProgressDto {
  @ApiProperty({ type: [CreateMonthlyProgressDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMonthlyProgressDto)
  items!: CreateMonthlyProgressDto[];
}
