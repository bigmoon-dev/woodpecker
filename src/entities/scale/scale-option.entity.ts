import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ScaleItem } from './scale-item.entity';

@Entity('scale_options')
export class ScaleOption {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  itemId: string;

  @Column({ type: 'text' })
  optionText: string;

  @Column({ type: 'int' })
  scoreValue: number;

  @Column({ type: 'int' })
  sortOrder: number;

  @ManyToOne(() => ScaleItem, (item) => item.options, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'itemId' })
  item: ScaleItem;
}
