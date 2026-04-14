import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('plugins')
export class Plugin {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100, unique: true })
  name: string;

  @Column({ length: 20, default: '1.0.0' })
  version: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ length: 20, default: 'installed' })
  status: string;

  @Column({ type: 'jsonb', nullable: true })
  config: Record<string, any> | null;

  @Column({ type: 'jsonb', nullable: true })
  settingsSchema: Record<string, any> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
