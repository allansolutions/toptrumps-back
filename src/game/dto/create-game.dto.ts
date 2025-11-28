import { IsNumber, IsOptional, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateGameDto {
  @ApiProperty({
    description: 'Maximum number of players allowed in the game',
    example: 2,
    minimum: 2,
    maximum: 6,
    required: false,
    default: 2,
  })
  @IsNumber()
  @Min(2)
  @Max(6)
  @IsOptional()
  maxPlayers?: number;
}
