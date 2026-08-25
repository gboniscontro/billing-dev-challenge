import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('billing_sequences')
export class BillingSequence {
  @PrimaryColumn()
  receiptBook: string;

  @Column({ type: 'integer', default: 0 })
  lastValue: number;
}
