import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  operatorId: string;

  @Column({ length: 100 })
  operatorName: string;

  @Column({ length: 100 })
  action: string;

  @Column({ length: 50 })
  entityType: string;

  @Column({ type: 'uuid', nullable: true })
  entityId: string;

  @Column({ type: 'jsonb', nullable: true })
  changes: Record<string, { before: unknown; after: unknown }> | null;

  @Column({ length: 45, nullable: true })
  ip: string;

  @Column({ length: 500, nullable: true })
  userAgent: string;

  @Column({ length: 128, nullable: true })
  integrityHash: string;

  @CreateDateColumn()
  createdAt: Date;
}
