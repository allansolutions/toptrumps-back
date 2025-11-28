import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameService } from './game.service';
import { PlayersService } from '../players/players.service';
import { JoinGameDto } from './dto/join-game.dto';
import { PlayCardDto } from './dto/play-card.dto';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  },
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly gameService: GameService,
    private readonly playersService: PlayersService,
  ) {}

  async handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    // Buscar jugador por socketId y marcarlo como desconectado
    const player = await this.playersService.findBySocketId(client.id);
    if (player) {
      await this.playersService.setReady(player.id, false);
      this.server.to(`game-${player.gameId}`).emit('playerDisconnected', {
        playerId: player.id,
        nickname: player.nickname,
      });
    }
  }

  @SubscribeMessage('createGame')
  async handleCreateGame(
    @MessageBody() data: { maxPlayers?: number },
    @ConnectedSocket() client: Socket,
  ) {
    const game = await this.gameService.create({
      maxPlayers: data.maxPlayers || 2,
    });
    return { event: 'gameCreated', data: game };
  }

  @SubscribeMessage('joinGame')
  async handleJoinGame(
    @MessageBody() joinGameDto: JoinGameDto,
    @ConnectedSocket() client: Socket,
  ) {
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

      client.join(`game-${game.id}`);

      // Notificar a todos en la sala
      this.server.to(`game-${game.id}`).emit('playerJoined', {
        player,
        totalPlayers: existingPlayers.length + 1,
        maxPlayers: game.maxPlayers,
      });

      return { event: 'joinedGame', data: { game, player } };
    } catch (error) {
      return { event: 'error', data: { message: error.message } };
    }
  }

  @SubscribeMessage('playerReady')
  async handlePlayerReady(
    @MessageBody() data: { gameId: number; playerId: number },
    @ConnectedSocket() client: Socket,
  ) {
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
      const updatedPlayers = await this.playersService.findByGameId(data.gameId);

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
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const result = await this.gameService.playRound(
        playCardDto.gameId,
        playCardDto.playerId,
        playCardDto.cardId,
        playCardDto.selectedAttribute,
      );

      // Notificar a todos en la sala del resultado
      this.server.to(`game-${playCardDto.gameId}`).emit('roundResult', {
        round: result.round,
        winner: result.winner,
        card1: result.card1,
        card2: result.card2,
        selectedAttribute: playCardDto.selectedAttribute,
      });

      // Verificar si el juego terminó
      const game = await this.gameService.findOne(playCardDto.gameId);
      if (game.status === 'finished') {
        this.server.to(`game-${playCardDto.gameId}`).emit('gameFinished', {
          winnerId: game.winnerId,
          game,
        });
      }

      return { event: 'cardPlayed', data: result };
    } catch (error) {
      return { event: 'error', data: { message: error.message } };
    }
  }

  @SubscribeMessage('getGameState')
  async handleGetGameState(
    @MessageBody() data: { gameId: number },
    @ConnectedSocket() client: Socket,
  ) {
    const game = await this.gameService.findOne(data.gameId);
    const players = await this.playersService.findByGameId(data.gameId);
    return { event: 'gameState', data: { game, players } };
  }

  @SubscribeMessage('leaveGame')
  async handleLeaveGame(
    @MessageBody() data: { gameId: number; playerId: number },
    @ConnectedSocket() client: Socket,
  ) {
    await this.playersService.remove(data.playerId);
    client.leave(`game-${data.gameId}`);

    this.server.to(`game-${data.gameId}`).emit('playerLeft', {
      playerId: data.playerId,
    });

    return { event: 'leftGame', data: { success: true } };
  }
}
