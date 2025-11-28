import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { GameService } from './game.service';
import { CreateGameDto } from './dto/create-game.dto';

@ApiTags('games')
@Controller('games')
export class GameController {
  constructor(private readonly gameService: GameService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new game' })
  create(@Body() createGameDto: CreateGameDto) {
    return this.gameService.create(createGameDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all games' })
  findAll() {
    return this.gameService.findAll();
  }

  @Get('waiting')
  @ApiOperation({ summary: 'Get all games waiting for players' })
  findWaiting() {
    return this.gameService.findWaitingGames();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a game by ID' })
  @ApiParam({ name: 'id', description: 'Game ID', example: 1 })
  findOne(@Param('id') id: string) {
    return this.gameService.findOne(+id);
  }

  @Patch(':id/start')
  @ApiOperation({ summary: 'Start a game manually' })
  @ApiParam({ name: 'id', description: 'Game ID', example: 1 })
  start(@Param('id') id: string) {
    return this.gameService.startGame(+id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a game' })
  @ApiParam({ name: 'id', description: 'Game ID', example: 1 })
  remove(@Param('id') id: string) {
    return this.gameService.remove(+id);
  }
}
