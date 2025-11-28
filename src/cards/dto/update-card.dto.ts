import { ApiProperty } from '@nestjs/swagger';

export class UpdateCardDto {
  @ApiProperty({
    description: 'Name of the card',
    example: 'Dragon Warrior',
    required: false,
  })
  name?: string;

  @ApiProperty({
    description: 'URL or path to card image',
    example: 'https://example.com/dragon.png',
    required: false,
  })
  image?: string;

  @ApiProperty({
    description: 'Power attribute (0-100)',
    example: 85,
    minimum: 0,
    maximum: 100,
    required: false,
  })
  power?: number;

  @ApiProperty({
    description: 'Speed attribute (0-100)',
    example: 70,
    minimum: 0,
    maximum: 100,
    required: false,
  })
  speed?: number;

  @ApiProperty({
    description: 'Intelligence attribute (0-100)',
    example: 60,
    minimum: 0,
    maximum: 100,
    required: false,
  })
  intelligence?: number;

  @ApiProperty({
    description: 'Defense attribute (0-100)',
    example: 90,
    minimum: 0,
    maximum: 100,
    required: false,
  })
  defense?: number;

  @ApiProperty({
    description: 'Agility attribute (0-100)',
    example: 75,
    minimum: 0,
    maximum: 100,
    required: false,
  })
  agility?: number;

  @ApiProperty({
    description: 'Card description or lore',
    example: 'A legendary warrior with dragon-like powers',
    required: false,
  })
  description?: string;

  @ApiProperty({
    description: 'Card rarity level',
    example: 'legendary',
    required: false,
  })
  rarity?: string;
}
