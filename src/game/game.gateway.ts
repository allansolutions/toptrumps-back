import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { GameService } from './game.service';
import { PlayersService } from '@players/players.service';
import { JoinGameDto } from './dto/join-game.dto';
import { PlayCardDto } from './dto/play-card.dto';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  },
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(GameGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly gameService: GameService,
    private readonly playersService: PlayersService,
  ) {}

  handleConnection(client: Socket): void {
    this.logger.log(`Client connected: ${client.id}`);
  }

  async handleDisconnect(client: Socket): Promise<void> {
    this.logger.log(`Client disconnected: ${client.id}`);
    // Buscar jugador por socketId y eliminarlo
    const player = await this.playersService.findBySocketId(client.id);
    if (player) {
      const result = await this.gameService.handlePlayerDisconnect(player.id);

      this.server.to(`game-${player.gameId}`).emit('playerDisconnected', {
        playerId: player.id,
        nickname: player.nickname,
        nextTurnPlayerId: result.nextTurnPlayerId,
      });

      if (result.gameFinished) {
        this.server.to(`game-${player.gameId}`).emit('gameFinished', {
          winnerId: result.winnerId ?? null,
          reason: 'insufficient_players',
        });
      }
    }
  }

  @SubscribeMessage('createGame')
  async handleCreateGame(
    @MessageBody() data: { maxPlayers?: number },
  ): Promise<{ event: string; data: unknown }> {
    const game = await this.gameService.create({
      maxPlayers: data.maxPlayers ?? 2,
    });
    return { event: 'gameCreated', data: game };
  }

  @SubscribeMessage('joinGame')
  async handleJoinGame(
    @MessageBody() joinGameDto: JoinGameDto,
    @ConnectedSocket() client: Socket,
  ): Promise<{ event: string; data: unknown }> {
    try {
      const game = await this.gameService.findOne(joinGameDto.gameId);
      const existingPlayers = await this.playersService.findByGameId(game.id);

      if (existingPlayers.length >= game.maxPlayers) {
        return { event: 'error', data: { message: 'Game is full' } };
      }

      const player = await this.playersService.create({
        nickname: joinGameDto.nickname,
        gameId: joinGameDto.gameId,
        socketId: client.id,
      });

      void client.join(`game-${game.id}`);

      // Notificar a todos en la sala
      this.server.to(`game-${game.id}`).emit('playerJoined', {
        player,
        totalPlayers: existingPlayers.length + 1,
        maxPlayers: game.maxPlayers,
      });

      return { event: 'joinedGame', data: { game, player } };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Error joining game: ${message}`, error);
      return { event: 'error', data: { message } };
    }
  }

  @SubscribeMessage('playerReady')
  async handlePlayerReady(
    @MessageBody() data: { gameId: number; playerId: number },
  ): Promise<{ event: string; data: unknown }> {
    await this.playersService.setReady(data.playerId, true);
    const players = await this.playersService.findByGameId(data.gameId);
    const allReady = players.every((p) => p.isReady);

    this.server.to(`game-${data.gameId}`).emit('playerReady', {
      playerId: data.playerId,
      allReady,
    });

    // Si todos están listos, iniciar el juego
    if (allReady && players.length >= 2) {
      const game = await this.gameService.startGame(data.gameId);
      const updatedPlayers = await this.playersService.findByGameId(
        data.gameId,
      );

      this.server.to(`game-${data.gameId}`).emit('gameStarted', {
        game,
        players: updatedPlayers,
      });
    }

    return { event: 'readyConfirmed', data: { allReady } };
  }

  @SubscribeMessage('playCard')
  async handlePlayCard(
    @MessageBody() playCardDto: PlayCardDto,
  ): Promise<{ event: string; data: unknown }> {
    try {
      const result = await this.gameService.playRoundMultiplayer(
        playCardDto.gameId,
        playCardDto.playerId,
        playCardDto.cardId,
        playCardDto.selectedAttribute,
      );

      // Emitir resultado de ronda a todos
      this.server.to(`game-${playCardDto.gameId}`).emit('roundResult', {
        playedCards: result.roundResult.playedCards,
        winnerId: result.roundResult.winnerId,
        nextTurnPlayerId: result.nextTurnPlayerId,
        selectedAttribute: playCardDto.selectedAttribute,
      });

      // Si terminó la partida
      if (result.gameFinished) {
        this.server.to(`game-${playCardDto.gameId}`).emit('gameFinished', {
          winnerId: result.finalWinnerId,
        });
      }

      return { event: 'cardPlayed', data: { success: true } };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Error playing card: ${message}`, error);
      return { event: 'error', data: { message } };
    }
  }

  @SubscribeMessage('getGameState')
  async handleGetGameState(
    @MessageBody() data: { gameId: number },
  ): Promise<{ event: string; data: unknown }> {
    const game = await this.gameService.findOne(data.gameId);
    const players = await this.playersService.findByGameId(data.gameId);
    return { event: 'gameState', data: { game, players } };
  }

  @SubscribeMessage('leaveGame')
  async handleLeaveGame(
    @MessageBody() data: { gameId: number; playerId: number },
    @ConnectedSocket() client: Socket,
  ): Promise<{ event: string; data: unknown }> {
    await this.playersService.remove(data.playerId);
    void client.leave(`game-${data.gameId}`);

    this.server.to(`game-${data.gameId}`).emit('playerLeft', {
      playerId: data.playerId,
    });

    return { event: 'leftGame', data: { success: true } };
  }
}
