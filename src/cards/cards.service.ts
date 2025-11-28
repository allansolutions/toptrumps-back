import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Card } from './entities/card.entity';
import { CreateCardDto } from './dto/create-card.dto';
import { UpdateCardDto } from './dto/update-card.dto';

@Injectable()
export class CardsService {
  constructor(
    @InjectRepository(Card)
    private cardsRepository: Repository<Card>,
  ) {}

  async create(createCardDto: CreateCardDto): Promise<Card> {
    const card = this.cardsRepository.create(createCardDto);
    return await this.cardsRepository.save(card);
  }

  async findAll(): Promise<Card[]> {
    return await this.cardsRepository.find();
  }

  async findOne(id: number): Promise<Card> {
    const card = await this.cardsRepository.findOne({ where: { id } });
    if (!card) {
      throw new NotFoundException(`Card with ID ${id} not found`);
    }
    return card;
  }

  async findByIds(ids: number[]): Promise<Card[]> {
    return await this.cardsRepository.findByIds(ids);
  }

  async update(id: number, updateCardDto: UpdateCardDto): Promise<Card> {
    const card = await this.findOne(id);
    Object.assign(card, updateCardDto);
    return await this.cardsRepository.save(card);
  }

  async remove(id: number): Promise<void> {
    const card = await this.findOne(id);
    await this.cardsRepository.remove(card);
  }

  async getRandomCards(count: number): Promise<Card[]> {
    const allCards = await this.findAll();
    const shuffled = allCards.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }
}
