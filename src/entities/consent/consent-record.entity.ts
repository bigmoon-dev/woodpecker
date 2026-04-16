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

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip: string;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;
}
