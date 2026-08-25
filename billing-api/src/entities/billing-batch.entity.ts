import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Invoice } from './invoice.entity';

export enum BatchStatus {
  PROCESSED = 'PROCESSED',
  ERROR = 'ERROR',
}

export enum SyncStatus {
  PENDING = 'PENDING',
  SYNCED = 'SYNCED',
  ERROR = 'ERROR',
}

@Entity('billing_batches')
export class BillingBatch {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'date' })
  issueDate: Date;

  @Column()
  receiptBook: string;

  @Column({
    type: 'enum',
    enum: BatchStatus,
    default: BatchStatus.PROCESSED,
  })
  status: BatchStatus;

  @Column({
    type: 'enum',
    enum: SyncStatus,
    default: SyncStatus.PENDING,
  })
  syncStatus: SyncStatus;

  @Column({ type: 'timestamp', nullable: true })
  syncedAt: Date;

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @OneToMany(() => Invoice, (invoice) => invoice.batch)
  invoices: Invoice[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

