import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Player } from './entities/player.entity';
import { CreatePlayerDto } from './dto/create-player.dto';

@Injectable()
export class PlayersService {
  constructor(
    @InjectRepository(Player)
    private playersRepository: Repository<Player>,
  ) {}

  async create(createPlayerDto: CreatePlayerDto): Promise<Player> {
    const player = this.playersRepository.create(createPlayerDto);
    return await this.playersRepository.save(player);
  }

  async findAll(): Promise<Player[]> {
    return await this.playersRepository.find({ relations: ['game'] });
  }

  async findOne(id: number): Promise<Player> {
    const player = await this.playersRepository.findOne({
      where: { id },
      relations: ['game'],
    });
    if (!player) {
      throw new NotFoundException(`Player with ID ${id} not found`);
    }
    return player;
  }

  async findByGameId(gameId: number): Promise<Player[]> {
    return await this.playersRepository.find({
      where: { gameId },
      relations: ['game'],
    });
  }

  async findBySocketId(socketId: string): Promise<Player | null> {
    return await this.playersRepository.findOne({
      where: { socketId },
      relations: ['game'],
    });
  }

  async updateSocketId(id: number, socketId: string): Promise<Player> {
    const player = await this.findOne(id);
    player.socketId = socketId;
    return await this.playersRepository.save(player);
  }

  async updateCards(id: number, cards: number[]): Promise<Player> {
    const player = await this.findOne(id);
    player.cards = cards;
    return await this.playersRepository.save(player);
  }

  async updateScore(id: number, score: number): Promise<Player> {
    const player = await this.findOne(id);
    player.score = score;
    return await this.playersRepository.save(player);
  }

  async setReady(id: number, isReady: boolean): Promise<Player> {
    const player = await this.findOne(id);
    player.isReady = isReady;
    return await this.playersRepository.save(player);
  }

  async remove(id: number): Promise<void> {
    const player = await this.findOne(id);
    await this.playersRepository.remove(player);
  }
}
