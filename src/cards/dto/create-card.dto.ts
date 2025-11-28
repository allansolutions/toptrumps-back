import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCardDto {
  @ApiProperty({
    description: 'Name of the card',
    example: 'Dragon Warrior',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    description: 'URL or path to card image',
    example: 'https://example.com/dragon.png',
    required: false,
  })
  @IsString()
  @IsOptional()
  image?: string;

  @ApiProperty({
    description: 'Power attribute (0-100)',
    example: 85,
    minimum: 0,
    maximum: 100,
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  power!: number;

  @ApiProperty({
    description: 'Speed attribute (0-100)',
    example: 70,
    minimum: 0,
    maximum: 100,
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  speed!: number;

  @ApiProperty({
    description: 'Intelligence attribute (0-100)',
    example: 60,
    minimum: 0,
    maximum: 100,
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  intelligence!: number;

  @ApiProperty({
    description: 'Defense attribute (0-100)',
    example: 90,
    minimum: 0,
    maximum: 100,
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  defense!: number;

  @ApiProperty({
    description: 'Agility attribute (0-100)',
    example: 75,
    minimum: 0,
    maximum: 100,
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  agility!: number;

  @ApiProperty({
    description: 'Card description or lore',
    example: 'A legendary warrior with dragon-like powers',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Card rarity level',
    example: 'legendary',
    required: false,
  })
  @IsString()
  @IsOptional()
  rarity?: string;
}
