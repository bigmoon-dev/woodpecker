import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Scale } from './scale.entity';

@Entity('score_ranges')
export class ScoreRange {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  scaleId: string;

  @Column({ length: 100, nullable: true })
  dimension: string;

  @Column({ type: 'float' })
  minScore: number;

  @Column({ type: 'float' })
  maxScore: number;

  @Column({ length: 20 })
  level: string;

  @Column({ length: 10, default: 'green' })
  color: string;

  @Column({ type: 'text', nullable: true })
  suggestion: string;

  @ManyToOne(() => Scale, (scale) => scale.scoreRanges, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'scaleId' })
  scale: Scale;
}
