import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('interview_files')
export class InterviewFile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  interviewId: string;

  @Column({ type: 'varchar', length: 500 })
  filePath: string;

  @Column({ type: 'varchar', length: 10 })
  fileType: string;

  @Column({ type: 'jsonb', nullable: true })
  ocrResult: Record<string, any> | null;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  ocrStatus: string;

  @CreateDateColumn()
  createdAt: Date;
}
