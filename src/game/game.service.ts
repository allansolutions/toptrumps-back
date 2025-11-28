import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Game, GameStatus } from './entities/game.entity';
import { GameRound } from './entities/game-round.entity';
import { CreateGameDto } from './dto/create-game.dto';
import { PlayersService } from '@players/players.service';
import { CardsService } from '@cards/cards.service';
import { Card } from '@cards/entities/card.entity';

interface PlayedCardInfo {
  playerId: number;
  nickname: string;
  cardId: number;
  cardName: string;
  value: number;
}

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
    let players = await this.playersService.findByGameId(gameId);

    // Obtener jugadores ready
    const readyPlayers = players.filter((p) => p.isReady);

    // Eliminar jugadores NO ready
    for (const player of players.filter((p) => !p.isReady)) {
      await this.playersService.remove(player.id);
    }

    // Actualizar lista de jugadores
    players = readyPlayers;

    if (players.length < 2) {
      throw new BadRequestException('Need at least 2 players ready to start');
    }

    // Calcular cartas por jugador según fórmula
    const numPlayers = players.length;
    let cardsPerPlayer: number;

    if (numPlayers <= 4) {
      cardsPerPlayer = 10;
    } else if (numPlayers === 5) {
      cardsPerPlayer = 9;
    } else {
      cardsPerPlayer = 8; // 6 jugadores
    }

    // Obtener cartas aleatorias
    const totalCardsNeeded = numPlayers * cardsPerPlayer;
    const randomCards =
      await this.cardsService.getRandomCards(totalCardsNeeded);

    // Distribuir equitativamente
    for (let i = 0; i < players.length; i++) {
      const playerCards = randomCards
        .slice(i * cardsPerPlayer, (i + 1) * cardsPerPlayer)
        .map((card) => card.id);
      await this.playersService.updateCards(players[i].id, playerCards);
    }

    // Establecer primer turno (primero que se unió)
    const firstPlayer = players.sort(
      (a, b) => a.joinedAt.getTime() - b.joinedAt.getTime(),
    )[0];

    game.status = GameStatus.IN_PROGRESS;
    game.currentTurnPlayerId = firstPlayer.id;
    game.currentRound = 1;

    return await this.gamesRepository.save(game);
  }

  async playRound(
    gameId: number,
    playerId: number,
    cardId: number,
    selectedAttribute: string,
  ): Promise<{ round: GameRound; winner: number; card1: Card; card2: Card }> {
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

    const card1Value = card1[selectedAttribute as keyof Card] as number;
    const card2Value = card2[selectedAttribute as keyof Card] as number;

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

    // Crear registro de la ronda (compatible con nueva estructura)
    const round = this.roundsRepository.create({
      gameId,
      roundNumber: 1, // Para compatibilidad con estructura antigua
      activePlayerId: currentPlayer.id,
      selectedAttribute,
      playedCards: [
        {
          playerId: currentPlayer.id,
          nickname: currentPlayer.nickname,
          cardId: cardId,
          cardName: card1.name,
          value: card1Value,
        },
        {
          playerId: opponent.id,
          nickname: opponent.nickname,
          cardId: opponentCardId,
          cardName: card2.name,
          value: card2Value,
        },
      ],
      winnerId,
    });
    await this.roundsRepository.save(round);

    // Remover las cartas jugadas
    currentPlayer.cards = currentPlayer.cards.filter((id) => id !== cardId);
    opponent.cards = opponent.cards.filter((id) => id !== opponentCardId);
    await this.playersService.updateCards(
      currentPlayer.id,
      currentPlayer.cards,
    );
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

  async playRoundMultiplayer(
    gameId: number,
    playerId: number,
    cardId: number,
    selectedAttribute: string,
  ): Promise<{
    roundResult: { playedCards: PlayedCardInfo[]; winnerId: number };
    gameFinished: boolean;
    finalWinnerId?: number;
    nextTurnPlayerId?: number;
  }> {
    // 1. Validar turno
    const game = await this.findOne(gameId);
    if (game.currentTurnPlayerId !== playerId) {
      throw new BadRequestException('No es tu turno');
    }

    if (game.status !== GameStatus.IN_PROGRESS) {
      throw new BadRequestException('Game is not in progress');
    }

    // 2. Obtener todos los jugadores
    const players = await this.playersService.findByGameId(gameId);

    // 3. Validar carta del jugador activo
    const activePlayer = players.find((p) => p.id === playerId);
    if (!activePlayer || !activePlayer.cards.includes(cardId)) {
      throw new BadRequestException('No tienes esa carta');
    }

    // 4. Obtener cartas jugadas de TODOS
    const playedCards: PlayedCardInfo[] = [];

    for (const player of players) {
      let selectedCardId: number;

      if (player.id === playerId) {
        // Jugador activo usa su carta seleccionada
        selectedCardId = cardId;
      } else {
        // Otros jugadores: carta random
        const randomIndex = Math.floor(Math.random() * player.cards.length);
        selectedCardId = player.cards[randomIndex];
      }

      const card = await this.cardsService.findOne(selectedCardId);

      playedCards.push({
        playerId: player.id,
        nickname: player.nickname,
        cardId: selectedCardId,
        cardName: card.name,
        value: card[selectedAttribute as keyof Card] as number,
      });
    }

    // 5. Determinar ganador (mayor valor en atributo seleccionado)
    const winner = playedCards.reduce((prev, current) =>
      current.value > prev.value ? current : prev,
    );

    // 6. Actualizar score del ganador
    const winnerPlayer = players.find((p) => p.id === winner.playerId);
    if (winnerPlayer) {
      await this.playersService.updateScore(
        winnerPlayer.id,
        winnerPlayer.score + 1,
      );
    }

    // 7. Eliminar cartas jugadas de los mazos
    for (const played of playedCards) {
      const player = players.find((p) => p.id === played.playerId);
      if (player) {
        const newCards = player.cards.filter((c) => c !== played.cardId);
        await this.playersService.updateCards(player.id, newCards);
      }
    }

    // 8. Guardar ronda en historial
    await this.roundsRepository.save({
      gameId,
      roundNumber: game.currentRound,
      activePlayerId: playerId,
      selectedAttribute,
      playedCards,
      winnerId: winner.playerId,
    });

    // 9. Verificar si alguien se quedó sin cartas
    const updatedPlayers = await this.playersService.findByGameId(gameId);
    const hasEmptyHand = updatedPlayers.some((p) => p.cards.length === 0);

    if (hasEmptyHand) {
      // Terminar partida
      const finalWinner = updatedPlayers.reduce((prev, current) =>
        current.score > prev.score ? current : prev,
      );

      await this.gamesRepository.update(gameId, {
        status: GameStatus.FINISHED,
        winnerId: finalWinner.id,
      });

      return {
        roundResult: { playedCards, winnerId: winner.playerId },
        gameFinished: true,
        finalWinnerId: finalWinner.id,
      };
    }

    // 10. Rotar turno al siguiente jugador
    const currentIndex = players.findIndex((p) => p.id === playerId);
    const nextIndex = (currentIndex + 1) % players.length;
    const nextPlayer = players[nextIndex];

    await this.gamesRepository.update(gameId, {
      currentTurnPlayerId: nextPlayer.id,
      currentRound: game.currentRound + 1,
    });

    return {
      roundResult: { playedCards, winnerId: winner.playerId },
      gameFinished: false,
      nextTurnPlayerId: nextPlayer.id,
    };
  }

  async handlePlayerDisconnect(playerId: number): Promise<{
    gameFinished: boolean;
    winnerId?: number;
    nextTurnPlayerId?: number;
  }> {
    const player = await this.playersService.findOne(playerId);
    const game = await this.findOne(player.gameId);

    // Eliminar jugador
    await this.playersService.remove(playerId);

    // Verificar jugadores restantes
    const remainingPlayers = await this.playersService.findByGameId(game.id);

    if (remainingPlayers.length < 2) {
      // Menos de 2 jugadores → terminar partida
      if (remainingPlayers.length === 1) {
        await this.gamesRepository.update(game.id, {
          status: GameStatus.FINISHED,
          winnerId: remainingPlayers[0].id,
        });
        return { gameFinished: true, winnerId: remainingPlayers[0].id };
      } else {
        // 0 jugadores → eliminar partida
        await this.gamesRepository.delete(game.id);
        return { gameFinished: true };
      }
    }

    // Si era el turno del eliminado, pasar al siguiente
    if (game.currentTurnPlayerId === playerId) {
      const nextPlayer = remainingPlayers[0];
      await this.gamesRepository.update(game.id, {
        currentTurnPlayerId: nextPlayer.id,
      });
      return { gameFinished: false, nextTurnPlayerId: nextPlayer.id };
    }

    return { gameFinished: false };
  }

  async remove(id: number): Promise<void> {
    const game = await this.findOne(id);
    await this.gamesRepository.remove(game);
  }
}
