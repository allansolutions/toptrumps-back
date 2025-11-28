import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Game, GameStatus } from './entities/game.entity';
import { GameRound } from './entities/game-round.entity';
import { CreateGameDto } from './dto/create-game.dto';
import { PlayersService } from '../players/players.service';
import { CardsService } from '../cards/cards.service';

@Injectable()
export class GameService {
  constructor(
    @InjectRepository(Game)
    private gamesRepository: Repository<Game>,
    @InjectRepository(GameRound)
    private roundsRepository: Repository<GameRound>,
    private playersService: PlayersService,
    private cardsService: CardsService,
  ) {}

  async create(createGameDto: CreateGameDto): Promise<Game> {
    const game = this.gamesRepository.create({
      maxPlayers: createGameDto.maxPlayers || 2,
      status: GameStatus.WAITING,
    });
    return await this.gamesRepository.save(game);
  }

  async findAll(): Promise<Game[]> {
    return await this.gamesRepository.find({
      relations: ['players', 'rounds'],
    });
  }

  async findOne(id: number): Promise<Game> {
    const game = await this.gamesRepository.findOne({
      where: { id },
      relations: ['players', 'rounds'],
    });
    if (!game) {
      throw new NotFoundException(`Game with ID ${id} not found`);
    }
    return game;
  }

  async findWaitingGames(): Promise<Game[]> {
    return await this.gamesRepository.find({
      where: { status: GameStatus.WAITING },
      relations: ['players'],
    });
  }

  async startGame(gameId: number): Promise<Game> {
    const game = await this.findOne(gameId);
    const players = await this.playersService.findByGameId(gameId);

    if (players.length < 2) {
      throw new BadRequestException('Need at least 2 players to start');
    }

    // Distribuir cartas a los jugadores
    const totalCardsNeeded = players.length * 10; // 10 cartas por jugador
    const randomCards = await this.cardsService.getRandomCards(
      totalCardsNeeded,
    );

    for (let i = 0; i < players.length; i++) {
      const playerCards = randomCards
        .slice(i * 10, (i + 1) * 10)
        .map((card) => card.id);
      await this.playersService.updateCards(players[i].id, playerCards);
    }

    game.status = GameStatus.IN_PROGRESS;
    game.currentTurnPlayerId = players[0].id;
    return await this.gamesRepository.save(game);
  }

  async playRound(
    gameId: number,
    playerId: number,
    cardId: number,
    selectedAttribute: string,
  ): Promise<{ round: GameRound; winner: number; card1: any; card2: any }> {
    const game = await this.findOne(gameId);
    const players = await this.playersService.findByGameId(gameId);

    if (game.status !== GameStatus.IN_PROGRESS) {
      throw new BadRequestException('Game is not in progress');
    }

    if (players.length !== 2) {
      throw new BadRequestException('Need exactly 2 players');
    }

    const currentPlayer = players.find((p) => p.id === playerId);
    const opponent = players.find((p) => p.id !== playerId);

    if (!currentPlayer || !opponent) {
      throw new NotFoundException('Player not found');
    }

    // El oponente juega una carta aleatoria
    const opponentCardId =
      opponent.cards[Math.floor(Math.random() * opponent.cards.length)];

    const card1 = await this.cardsService.findOne(cardId);
    const card2 = await this.cardsService.findOne(opponentCardId);

    const card1Value = card1[selectedAttribute];
    const card2Value = card2[selectedAttribute];

    let winnerId: number;
    if (card1Value > card2Value) {
      winnerId = currentPlayer.id;
      await this.playersService.updateScore(
        currentPlayer.id,
        currentPlayer.score + 1,
      );
    } else if (card2Value > card1Value) {
      winnerId = opponent.id;
      await this.playersService.updateScore(opponent.id, opponent.score + 1);
    } else {
      winnerId = 0; // Empate
    }

    // Crear registro de la ronda
    const round = this.roundsRepository.create({
      gameId,
      player1Id: currentPlayer.id,
      player2Id: opponent.id,
      cardId1: cardId,
      cardId2: opponentCardId,
      selectedAttribute,
      card1Value,
      card2Value,
      winnerId,
    });
    await this.roundsRepository.save(round);

    // Remover las cartas jugadas
    currentPlayer.cards = currentPlayer.cards.filter((id) => id !== cardId);
    opponent.cards = opponent.cards.filter((id) => id !== opponentCardId);
    await this.playersService.updateCards(currentPlayer.id, currentPlayer.cards);
    await this.playersService.updateCards(opponent.id, opponent.cards);

    // Verificar si el juego terminó
    if (currentPlayer.cards.length === 0 || opponent.cards.length === 0) {
      const finalWinner =
        currentPlayer.score > opponent.score
          ? currentPlayer.id
          : opponent.score > currentPlayer.score
            ? opponent.id
            : 0;
      game.status = GameStatus.FINISHED;
      game.winnerId = finalWinner;
      await this.gamesRepository.save(game);
    }

    return { round, winner: winnerId, card1, card2 };
  }

  async finishGame(gameId: number, winnerId: number): Promise<Game> {
    const game = await this.findOne(gameId);
    game.status = GameStatus.FINISHED;
    game.winnerId = winnerId;
    return await this.gamesRepository.save(game);
  }

  async remove(id: number): Promise<void> {
    const game = await this.findOne(id);
    await this.gamesRepository.remove(game);
  }
}
