import { IsNotEmpty, IsNumber, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class JoinGameDto {
  @ApiProperty({
    description: 'ID of the game to join',
    example: 1,
  })
  @IsNumber()
  gameId!: number;

  @ApiProperty({
    description: 'Player nickname for the game',
    example: 'Player1',
  })
  @IsString()
  @IsNotEmpty()
  nickname!: string;
}
