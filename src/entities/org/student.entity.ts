import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Class } from './class.entity';

@Entity('students')
@Index(['studentNumberHash'], { unique: true })
export class Student {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  classId: string;

  @Column({ type: 'bytea', nullable: true })
  encryptedName: Buffer | null;

  @Column({ type: 'bytea', nullable: true })
  encryptedStudentNumber: Buffer | null;

  @Column({ type: 'bytea', nullable: true })
  encryptedContact: Buffer | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  studentNumberHash: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  gender: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Class, (cls) => cls.students, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'classId' })
  class: Class;
}
