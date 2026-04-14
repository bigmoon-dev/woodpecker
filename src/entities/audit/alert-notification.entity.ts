import {
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { AlertRecord } from './alert-record.entity';

@Entity('alert_notifications')
export class AlertNotification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  alertId: string;

  @ManyToOne(() => AlertRecord)
  @JoinColumn({ name: 'alertId' })
  alert: AlertRecord;

  @Column({ type: 'uuid' })
  targetUserId: string;

  @Column({ type: 'varchar', length: 50 })
  targetRole: string;

  @Column({ type: 'boolean', default: false })
  read: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
