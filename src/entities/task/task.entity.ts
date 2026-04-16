import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Scale } from '../scale/scale.entity';
import { User } from '../auth/user.entity';

@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  scaleId: string;

  @Column({ length: 200 })
  title: string;

  @Column({ type: 'jsonb' })
  targetIds: string[];

  @Column({ length: 20, default: 'class' })
  targetType: string;

  @Column({ type: 'timestamp', nullable: true })
  deadline: Date;

  @Column({ length: 20, default: 'draft' })
  status: string;

  @Column({ type: 'uuid' })
  createdById: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Scale)
  @JoinColumn({ name: 'scaleId' })
  scale: Scale;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdById' })
  createdBy: User;
}
