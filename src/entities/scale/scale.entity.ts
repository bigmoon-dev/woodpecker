import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ScaleItem } from './scale-item.entity';
import { ScoringRule } from './scoring-rule.entity';
import { ScoreRange } from './score-range.entity';
import { ScaleValidation } from './scale-validation.entity';

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

  @Column({ type: 'varchar', length: 200, nullable: true })
  source: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  validationInfo: string;

  @Column({ default: false })
  isLibrary: boolean;

  @Column({ type: 'uuid', nullable: true })
  parentScaleId: string | null;

  @Column({ length: 20, default: 'draft' })
  versionStatus: string;

  @Column({ type: 'timestamp', nullable: true })
  publishedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Scale, { nullable: true })
  @JoinColumn({ name: 'parentScaleId' })
  parentScale: Scale | null;

  @OneToMany(() => Scale, (s) => s.parentScale)
  childVersions: Scale[];

  @OneToMany(() => ScaleItem, (item) => item.scale, { cascade: true })
  items: ScaleItem[];

  @OneToMany(() => ScoringRule, (rule) => rule.scale, { cascade: true })
  scoringRules: ScoringRule[];

  @OneToMany(() => ScoreRange, (range) => range.scale, { cascade: true })
  scoreRanges: ScoreRange[];

  @OneToMany(() => ScaleValidation, (v) => v.scale)
  validations: ScaleValidation[];
}
