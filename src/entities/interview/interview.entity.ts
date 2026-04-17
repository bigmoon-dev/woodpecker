import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('interviews')
export class Interview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  studentId: string;

  @Column({ type: 'uuid' })
  psychologistId: string;

  @Column({ type: 'timestamp' })
  interviewDate: Date;

  @Column({ type: 'varchar', length: 200, nullable: true })
  location: string | null;

  @Column({ type: 'varchar', length: 20, default: 'normal' })
  riskLevel: string;

  @Column({ type: 'bytea', nullable: true })
  encryptedContent: Buffer | null;

  @Column({ type: 'text', nullable: true })
  ocrText: string | null;

  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'uuid', nullable: true })
  templateId: string;

  @Column({ type: 'jsonb', nullable: true })
  structuredSummary: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
