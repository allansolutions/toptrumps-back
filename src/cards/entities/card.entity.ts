import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('cards')
export class Card {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column({ nullable: true })
  image!: string;

  @Column({ type: 'int' })
  power!: number;

  @Column({ type: 'int' })
  speed!: number;

  @Column({ type: 'int' })
  intelligence!: number;

  @Column({ type: 'int' })
  defense!: number;

  @Column({ type: 'int' })
  agility!: number;

  @Column({ type: 'text', nullable: true })
  description!: string;

  @Column({ default: 'common' })
  rarity!: string; // common, rare, epic, legendary

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}
