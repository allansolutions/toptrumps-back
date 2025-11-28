import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Player } from '@players/entities/player.entity';
import { GameRound } from './game-round.entity';

export enum GameStatus {
  WAITING = 'waiting',
  IN_PROGRESS = 'in_progress',
  FINISHED = 'finished',
}

@Entity('games')
export class Game {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({
    type: 'text',
    enum: GameStatus,
    default: GameStatus.WAITING,
  })
  status!: GameStatus;

  @Column({ nullable: true })
  winnerId!: number;

  @Column({ default: 2 })
  maxPlayers!: number;

  @Column({ nullable: true })
  currentTurnPlayerId!: number;

  @Column({ default: 1 })
  currentRound!: number;

  @OneToMany(() => Player, (player) => player.game)
  players!: Player[];

  @OneToMany(() => GameRound, (round) => round.game)
  rounds!: GameRound[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
