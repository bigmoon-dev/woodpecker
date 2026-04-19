import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { AlertRecord } from './alert-record.entity';

@Entity('alert_handling_records')
export class AlertHandlingRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  alertId: string;

  @ManyToOne(() => AlertRecord)
  @JoinColumn({ name: 'alertId' })
  alert: AlertRecord;

  @Column({ type: 'uuid' })
  handledById: string;

  @Column({ length: 20 })
  action: string;

  @Column({ type: 'text' })
  note: string;

  @CreateDateColumn()
  createdAt: Date;
}
