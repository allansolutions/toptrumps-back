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

  /**
   * Shuffle array using Fisher-Yates algorithm
   */
  private shuffleCards<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

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

    // Obtener TODAS las cartas disponibles en la base de datos
    const allCards = await this.cardsService.findAll();
    const numPlayers = players.length;

    if (allCards.length < numPlayers) {
      throw new BadRequestException(
        'Not enough cards in database for all players',
      );
    }

    // Mezclar todas las cartas
    const shuffledCards = this.shuffleCards(allCards);

    // Determinar cuántas cartas dar a cada jugador
    // Para distribución EQUITATIVA: todos reciben exactamente el mismo número
    let cardsPerPlayer: number;

    if (numPlayers === 2) {
      // Con 2 jugadores: máximo 12 cartas cada uno (24 total)
      cardsPerPlayer = Math.min(
        12,
        Math.floor(shuffledCards.length / numPlayers),
      );
    } else if (numPlayers === 3) {
      // Con 3 jugadores: máximo 8 cartas cada uno (24 total)
      cardsPerPlayer = Math.min(
        8,
        Math.floor(shuffledCards.length / numPlayers),
      );
    } else if (numPlayers === 4) {
      // Con 4 jugadores: máximo 6 cartas cada uno (24 total)
      cardsPerPlayer = Math.min(
        6,
        Math.floor(shuffledCards.length / numPlayers),
      );
    } else if (numPlayers === 5) {
      // Con 5 jugadores: 5 cartas cada uno (25 total - usa todo el mazo)
      cardsPerPlayer = Math.min(
        5,
        Math.floor(shuffledCards.length / numPlayers),
      );
    } else {
      // Con 6+ jugadores: 4 cartas cada uno
      cardsPerPlayer = Math.min(
        4,
        Math.floor(shuffledCards.length / numPlayers),
      );
    }

    // Validar que hay suficientes cartas
    const totalCardsNeeded = numPlayers * cardsPerPlayer;
    if (shuffledCards.length < totalCardsNeeded) {
      throw new BadRequestException(
        `Not enough cards: need ${totalCardsNeeded} but only have ${shuffledCards.length}`,
      );
    }

    // Repartir EXACTAMENTE el mismo número de cartas a cada jugador
    // Las cartas sobrantes NO se reparten (quedan fuera del juego)
    for (let i = 0; i < players.length; i++) {
      const startIndex = i * cardsPerPlayer;
      const endIndex = startIndex + cardsPerPlayer;
      const playerCards = shuffledCards
        .slice(startIndex, endIndex)
        .map((card: Card) => card.id);
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
      // El ganador recibe ambas cartas
      currentPlayer.cards.push(cardId, opponentCardId);
    } else if (card2Value > card1Value) {
      winnerId = opponent.id;
      // El ganador recibe ambas cartas
      opponent.cards.push(cardId, opponentCardId);
    } else {
      winnerId = 0; // Empate - ambas cartas se descartan
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

    // Actualizar cartas de los jugadores (ya se agregaron al ganador arriba)
    if (winnerId !== 0) {
      // Si hubo ganador, remover cartas jugadas de ambos jugadores primero
      currentPlayer.cards = currentPlayer.cards.filter(
        (id) => id !== cardId && id !== opponentCardId,
      );
      opponent.cards = opponent.cards.filter(
        (id) => id !== cardId && id !== opponentCardId,
      );

      // Luego agregar las cartas al ganador
      if (winnerId === currentPlayer.id) {
        currentPlayer.cards.push(cardId, opponentCardId);
      } else {
        opponent.cards.push(cardId, opponentCardId);
      }
    } else {
      // Empate: remover las cartas de ambos jugadores
      currentPlayer.cards = currentPlayer.cards.filter((id) => id !== cardId);
      opponent.cards = opponent.cards.filter((id) => id !== opponentCardId);
    }

    await this.playersService.updateCards(
      currentPlayer.id,
      currentPlayer.cards,
    );
    await this.playersService.updateCards(opponent.id, opponent.cards);

    // Verificar si el juego terminó (alguien tiene todas las cartas o solo queda uno con cartas)
    if (currentPlayer.cards.length === 0 || opponent.cards.length === 0) {
      const finalWinner =
        currentPlayer.cards.length > 0
          ? currentPlayer.id
          : opponent.cards.length > 0
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
    roundResult: {
      playedCards: PlayedCardInfo[];
      winnerId: number;
      isTie?: boolean;
    };
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

    // 5. Determinar si hay empate o ganador
    const maxValue = Math.max(...playedCards.map((pc) => pc.value));
    const winners = playedCards.filter((pc) => pc.value === maxValue);

    const isTie = winners.length > 1;

    if (isTie) {
      // EMPATE: Cartas van al stake
      const allPlayedCardIds = playedCards.map((pc) => pc.cardId);
      const currentStake = game.stakeCards || [];
      const newStake = [...currentStake, ...allPlayedCardIds];

      // Remover cartas de los jugadores (van al stake)
      for (const played of playedCards) {
        const player = players.find((p) => p.id === played.playerId);
        if (player) {
          const newCards = player.cards.filter((c) => c !== played.cardId);
          await this.playersService.updateCards(player.id, newCards);
        }
      }

      // Actualizar stake en el juego
      await this.gamesRepository.update(gameId, {
        stakeCards: newStake,
        currentRound: game.currentRound + 1,
        // El turno permanece en el mismo jugador en caso de empate
      });

      // Guardar ronda en historial (winnerId = 0 indica empate)
      await this.roundsRepository.save({
        gameId,
        roundNumber: game.currentRound,
        activePlayerId: playerId,
        selectedAttribute,
        playedCards,
        winnerId: 0, // 0 indica empate
      });

      // Verificar si alguien se quedó sin cartas después del empate
      const updatedPlayers = await this.playersService.findByGameId(gameId);
      const playersWithCards = updatedPlayers.filter((p) => p.cards.length > 0);

      if (playersWithCards.length === 1) {
        // Solo queda un jugador con cartas
        await this.gamesRepository.update(gameId, {
          status: GameStatus.FINISHED,
          winnerId: playersWithCards[0].id,
        });

        return {
          roundResult: { playedCards, winnerId: 0, isTie: true },
          gameFinished: true,
          finalWinnerId: playersWithCards[0].id,
        };
      } else if (playersWithCards.length === 0) {
        // Todos se quedaron sin cartas en el empate - no debería pasar normalmente
        // Gana quien tenía más cartas antes
        const lastWinner = updatedPlayers.reduce((prev, current) =>
          current.cards.length > prev.cards.length ? current : prev,
        );

        await this.gamesRepository.update(gameId, {
          status: GameStatus.FINISHED,
          winnerId: lastWinner.id,
        });

        return {
          roundResult: { playedCards, winnerId: 0, isTie: true },
          gameFinished: true,
          finalWinnerId: lastWinner.id,
        };
      }

      return {
        roundResult: { playedCards, winnerId: 0, isTie: true },
        gameFinished: false,
        nextTurnPlayerId: playerId, // Mismo jugador elige en el siguiente turno
      };
    }

    // HAY GANADOR: Transferir cartas
    const winner = winners[0];

    // 6. El ganador recibe TODAS las cartas jugadas + el stake
    const winnerPlayer = players.find((p) => p.id === winner.playerId)!;
    const allPlayedCardIds = playedCards.map((pc) => pc.cardId);
    const currentStake = game.stakeCards || [];

    // Cartas que el ganador recibe: las jugadas + las del stake
    const cardsToAdd = [...allPlayedCardIds, ...currentStake];
    const winnerNewCards = [...winnerPlayer.cards, ...cardsToAdd];

    await this.playersService.updateCards(winner.playerId, winnerNewCards);

    // 7. Remover cartas de los perdedores
    for (const played of playedCards) {
      if (played.playerId !== winner.playerId) {
        const loser = players.find((p) => p.id === played.playerId);
        if (loser) {
          const loserNewCards = loser.cards.filter((c) => c !== played.cardId);
          await this.playersService.updateCards(loser.id, loserNewCards);
        }
      }
    }

    // 8. Limpiar el stake y actualizar turno al ganador
    await this.gamesRepository.update(gameId, {
      stakeCards: [],
      currentTurnPlayerId: winner.playerId, // El ganador elige el siguiente
      currentRound: game.currentRound + 1,
    });

    // 9. Guardar ronda en historial
    await this.roundsRepository.save({
      gameId,
      roundNumber: game.currentRound,
      activePlayerId: playerId,
      selectedAttribute,
      playedCards,
      winnerId: winner.playerId,
    });

    // 10. Verificar condición de victoria
    const updatedPlayers = await this.playersService.findByGameId(gameId);
    const playersWithCards = updatedPlayers.filter((p) => p.cards.length > 0);

    if (playersWithCards.length === 1) {
      // Solo queda 1 jugador con cartas - ES EL GANADOR
      await this.gamesRepository.update(gameId, {
        status: GameStatus.FINISHED,
        winnerId: playersWithCards[0].id,
      });

      return {
        roundResult: { playedCards, winnerId: winner.playerId, isTie: false },
        gameFinished: true,
        finalWinnerId: playersWithCards[0].id,
      };
    }

    // Verificar si alguien tiene TODAS las cartas (victoria absoluta)
    const totalCardsInGame = updatedPlayers.reduce(
      (sum, p) => sum + p.cards.length,
      0,
    );
    const hasAllCards = updatedPlayers.find(
      (p) => p.cards.length === totalCardsInGame,
    );

    if (hasAllCards) {
      await this.gamesRepository.update(gameId, {
        status: GameStatus.FINISHED,
        winnerId: hasAllCards.id,
      });

      return {
        roundResult: { playedCards, winnerId: winner.playerId, isTie: false },
        gameFinished: true,
        finalWinnerId: hasAllCards.id,
      };
    }

    return {
      roundResult: { playedCards, winnerId: winner.playerId, isTie: false },
      gameFinished: false,
      nextTurnPlayerId: winner.playerId, // El ganador elige el siguiente atributo
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
