import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Game } from '@game/entities/game.entity';

@Entity('players')
export class Player {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  nickname!: string;

  @Column({ nullable: true })
  socketId!: string;

  @Column({ type: 'simple-json', nullable: true })
  cards!: number[]; // Array de IDs de cartas

  @Column({ default: false })
  isReady!: boolean;

  @ManyToOne(() => Game, (game) => game.players, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'gameId' })
  game!: Game;

  @Column()
  gameId!: number;

  @CreateDateColumn()
  joinedAt!: Date;
}
