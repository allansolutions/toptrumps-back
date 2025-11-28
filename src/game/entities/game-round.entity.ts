import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Game } from './game.entity';

@Entity('game_rounds')
export class GameRound {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Game, (game) => game.rounds, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'gameId' })
  game!: Game;

  @Column()
  gameId!: number;

  @Column()
  roundNumber!: number;

  @Column()
  activePlayerId!: number; // quien eligió el atributo

  @Column()
  selectedAttribute!: string; // power, speed, intelligence, defense, agility

  @Column('json')
  playedCards!: Array<{
    playerId: number;
    nickname: string;
    cardId: number;
    cardName: string;
    value: number;
  }>;

  @Column({ nullable: true })
  winnerId!: number;

  @CreateDateColumn()
  playedAt!: Date;
}
