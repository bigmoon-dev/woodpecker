import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Scale } from './scale.entity';

@Entity('scale_validations')
export class ScaleValidation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  scaleId: string;

  @Column({
    length: 30,
  })
  reliabilityType: string;

  @Column({ type: 'float' })
  reliabilityValue: number;

  @Column({
    length: 30,
  })
  validityType: string;

  @Column({ type: 'text', nullable: true })
  validityDetail: string | null;

  @Column({ type: 'int', nullable: true })
  sampleSize: number | null;

  @Column({ type: 'text', nullable: true })
  population: string | null;

  @Column({ type: 'text', nullable: true })
  referenceSource: string | null;

  @Column({ type: 'timestamp' })
  validatedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Scale, (scale) => scale.validations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'scaleId' })
  scale: Scale;
}
