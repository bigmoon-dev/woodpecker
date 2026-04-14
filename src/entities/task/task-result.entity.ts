import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { TaskAnswer } from './task-answer.entity';

@Entity('task_results')
export class TaskResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  answerId: string;

  @Column({ type: 'float' })
  totalScore: number;

  @Column({ type: 'jsonb', nullable: true })
  dimensionScores: Record<string, number>;

  @Column({ length: 20 })
  level: string;

  @Column({ length: 10, default: 'green' })
  color: string;

  @Column({ type: 'text', nullable: true })
  suggestion: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => TaskAnswer)
  @JoinColumn({ name: 'answerId' })
  answer: TaskAnswer;
}
