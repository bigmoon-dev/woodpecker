import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Scale } from './scale.entity';

@Entity('scoring_rules')
export class ScoringRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  scaleId: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  dimension: string;

  @Column({ length: 30, default: 'sum' })
  formulaType: string;

  @Column({ type: 'float', default: 1 })
  weight: number;

  @Column({ type: 'jsonb', nullable: true })
  config: Record<string, any>;

  @ManyToOne(() => Scale, (scale) => scale.scoringRules, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'scaleId' })
  scale: Scale;
}
