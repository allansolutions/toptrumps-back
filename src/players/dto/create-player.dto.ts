import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePlayerDto {
  @ApiProperty({
    description: 'Player nickname',
    example: 'DragonSlayer99',
  })
  @IsString()
  @IsNotEmpty()
  nickname!: string;

  @ApiProperty({
    description: 'ID of the game to join',
    example: 1,
  })
  @IsNumber()
  gameId!: number;

  @ApiProperty({
    description: 'Socket ID for real-time connection',
    example: 'abc123xyz',
    required: false,
  })
  @IsString()
  @IsOptional()
  socketId?: string;
}
