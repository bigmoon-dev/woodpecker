import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  Unique,
} from 'typeorm';
import { Class } from './class.entity';

@Entity('grades')
@Unique(['name'])
export class Grade {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 50 })
  name: string;

  @Column({ type: 'int' })
  sortOrder: number;

  @Column({ length: 10, nullable: true })
  year?: string;

  @Column({ length: 20, nullable: true })
  cohort?: string;

  @Column({
    type: 'enum',
    enum: ['active', 'archived'],
    default: 'active',
  })
  status: 'active' | 'archived';

  @OneToMany(() => Class, (cls) => cls.grade)
  classes: Class[];
}
