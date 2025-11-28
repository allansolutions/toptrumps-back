import { IsIn, IsNumber, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PlayCardDto {
  @ApiProperty({
    description: 'ID of the game',
    example: 1,
  })
  @IsNumber()
  gameId!: number;

  @ApiProperty({
    description: 'ID of the player making the move',
    example: 1,
  })
  @IsNumber()
  playerId!: number;

  @ApiProperty({
    description: 'ID of the card to play',
    example: 5,
  })
  @IsNumber()
  cardId!: number;

  @ApiProperty({
    description: 'Attribute to compare in this round',
    example: 'power',
    enum: ['power', 'speed', 'intelligence', 'defense', 'agility'],
  })
  @IsString()
  @IsIn(['power', 'speed', 'intelligence', 'defense', 'agility'])
  selectedAttribute!: string;
}
