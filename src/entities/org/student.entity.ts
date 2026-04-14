import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Class } from './class.entity';

@Entity('students')
export class Student {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  classId: string;

  @Column({ type: 'bytea', nullable: true })
  encryptedName: Buffer;

  @Column({ type: 'bytea', nullable: true })
  encryptedStudentNumber: Buffer;

  @Column({ type: 'bytea', nullable: true })
  encryptedContact: Buffer;

  @Column({ length: 10, nullable: true })
  gender: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Class, (cls) => cls.students, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'classId' })
  class: Class;
}
