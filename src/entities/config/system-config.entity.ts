import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('system_config')
export class SystemConfig {
  @PrimaryColumn()
  key: string;

  @Column({ type: 'text' })
  value: string;

  @Column({ type: 'varchar', length: 50, default: 'general' })
  category: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 20, default: 'string' })
  valueType: string;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'varchar', length: 100, nullable: true })
  updatedBy: string;
}
