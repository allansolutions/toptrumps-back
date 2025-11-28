import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CardsService } from './cards.service';
import { CreateCardDto } from './dto/create-card.dto';
import { UpdateCardDto } from './dto/update-card.dto';

@ApiTags('cards')
@Controller('cards')
export class CardsController {
  constructor(private readonly cardsService: CardsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new card' })
  create(@Body() createCardDto: CreateCardDto) {
    return this.cardsService.create(createCardDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all cards' })
  findAll() {
    return this.cardsService.findAll();
  }

  @Get('random')
  @ApiOperation({ summary: 'Get random cards for distribution' })
  @ApiQuery({
    name: 'count',
    required: false,
    description: 'Number of random cards to retrieve',
    example: 10,
  })
  getRandomCards(@Query('count') count: string) {
    return this.cardsService.getRandomCards(parseInt(count) || 10);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a card by ID' })
  @ApiParam({ name: 'id', description: 'Card ID', example: 1 })
  findOne(@Param('id') id: string) {
    return this.cardsService.findOne(+id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a card' })
  @ApiParam({ name: 'id', description: 'Card ID', example: 1 })
  update(@Param('id') id: string, @Body() updateCardDto: UpdateCardDto) {
    return this.cardsService.update(+id, updateCardDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a card' })
  @ApiParam({ name: 'id', description: 'Card ID', example: 1 })
  remove(@Param('id') id: string) {
    return this.cardsService.remove(+id);
  }
}
