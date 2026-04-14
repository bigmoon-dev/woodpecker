import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../auth/user.entity';

@Entity('consent_records')
export class ConsentRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid', nullable: true })
  studentId: string;

  @Column({ length: 50 })
  consentType: string;

  @Column({ length: 64 })
  contentHash: string;

  @Column({ type: 'timestamp' })
  signedAt: Date;

  @Column({ length: 45, nullable: true })
  ip: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;
}
