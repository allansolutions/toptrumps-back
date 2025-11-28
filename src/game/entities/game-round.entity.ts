import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Game } from './game.entity';

@Entity('game_rounds')
export class GameRound {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Game, (game) => game.rounds, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'gameId' })
  game: Game;

  @Column()
  gameId: number;

  @Column()
  player1Id: number;

  @Column()
  player2Id: number;

  @Column()
  cardId1: number;

  @Column()
  cardId2: number;

  @Column()
  selectedAttribute: string; // power, speed, intelligence, defense, agility

  @Column()
  card1Value: number;

  @Column()
  card2Value: number;

  @Column()
  winnerId: number;

  @CreateDateColumn()
  playedAt: Date;
}
