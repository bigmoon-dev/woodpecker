import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ScaleItem } from './scale-item.entity';
import { ScoringRule } from './scoring-rule.entity';
import { ScoreRange } from './score-range.entity';

@Entity('scales')
export class Scale {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 200 })
  name: string;

  @Column({ length: 20, default: '1.0' })
  version: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ length: 20, default: 'draft' })
  status: string;

  @Column({ length: 200, nullable: true })
  source: string;

  @Column({ length: 500, nullable: true })
  validationInfo: string;

  @Column({ default: false })
  isLibrary: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => ScaleItem, (item) => item.scale, { cascade: true })
  items: ScaleItem[];

  @OneToMany(() => ScoringRule, (rule) => rule.scale, { cascade: true })
  scoringRules: ScoringRule[];

  @OneToMany(() => ScoreRange, (range) => range.scale, { cascade: true })
  scoreRanges: ScoreRange[];
}
