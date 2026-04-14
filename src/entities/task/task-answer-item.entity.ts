import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { TaskAnswer } from './task-answer.entity';

@Entity('task_answer_items')
export class TaskAnswerItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  answerId: string;

  @Column({ type: 'uuid' })
  itemId: string;

  @Column({ type: 'uuid', nullable: true })
  optionId: string;

  @Column({ type: 'int', default: 0 })
  score: number;

  @ManyToOne(() => TaskAnswer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'answerId' })
  answer: TaskAnswer;
}
