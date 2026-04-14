import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('plugin_hooks')
export class PluginHook {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  pluginId: string;

  @Column({ length: 100 })
  event: string;

  @Column({ length: 200, nullable: true })
  description: string;

  @Column({ default: 100 })
  priority: number;

  @Column({ default: true })
  enabled: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
