import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Scale } from './scale.entity';
import { ScaleOption } from './scale-option.entity';

@Entity('scale_items')
export class ScaleItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  scaleId: string;

  @Column({ type: 'text' })
  itemText: string;

  @Column({ length: 30, default: 'single_choice' })
  itemType: string;

  @Column({ type: 'int' })
  sortOrder: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  dimension: string;

  @Column({ type: 'boolean', default: false })
  reverseScore: boolean;

  @ManyToOne(() => Scale, (scale) => scale.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'scaleId' })
  scale: Scale;

  @OneToMany(() => ScaleOption, (option) => option.item, { cascade: true })
  options: ScaleOption[];
}
