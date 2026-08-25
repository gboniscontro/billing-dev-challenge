import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingPending } from '../entities/billing-pending.entity';
import { BillingBatch } from '../entities/billing-batch.entity';
import { Invoice } from '../entities/invoice.entity';
import { Service } from '../entities/service.entity';
import { BillingSequence } from '../entities/billing-sequence.entity';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';

@Module({
  imports: [TypeOrmModule.forFeature([BillingPending, BillingBatch, Invoice, Service, BillingSequence])],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}