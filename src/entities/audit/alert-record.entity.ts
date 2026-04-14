import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('alert_records')
export class AlertRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  resultId: string;

  @Column({ type: 'uuid' })
  studentId: string;

  @Column({ length: 10, default: 'red' })
  level: string;

  @Column({ length: 20, default: 'pending' })
  status: string;

  @Column({ type: 'uuid', nullable: true })
  handledById: string;

  @Column({ type: 'text', nullable: true })
  handleNote: string;

  @Column({ type: 'timestamp', nullable: true })
  handledAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
