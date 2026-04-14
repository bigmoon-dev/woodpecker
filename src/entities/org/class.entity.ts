import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Grade } from './grade.entity';
import { Student } from './student.entity';

@Entity('classes')
export class Class {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  gradeId: string;

  @Column({ length: 50 })
  name: string;

  @Column({ type: 'int' })
  sortOrder: number;

  @ManyToOne(() => Grade, (grade) => grade.classes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'gradeId' })
  grade: Grade;

  @OneToMany(() => Student, (student) => student.class)
  students: Student[];
}
