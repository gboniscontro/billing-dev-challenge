import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { BillingPending, PendingStatus } from '../entities/billing-pending.entity';
import { BillingBatch, BatchStatus, SyncStatus } from '../entities/billing-batch.entity';
import { Invoice } from '../entities/invoice.entity';
import { Service, ServiceStatus } from '../entities/service.entity';
import { CreateBatchDto } from './dto/create-batch.dto';
import { BillingSequence } from '../entities/billing-sequence.entity';

@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(BillingPending)
    private readonly pendingRepository: Repository<BillingPending>,
    @InjectRepository(BillingBatch)
    private readonly batchRepository: Repository<BillingBatch>,
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(Service)
    private readonly serviceRepository: Repository<Service>,
    private readonly dataSource: DataSource,
  ) {}

  async sendServiceToBilling(serviceId: number) {
    return this.dataSource.transaction(async (transactionalEntityManager) => {
      const service = await transactionalEntityManager
        .createQueryBuilder(Service, 'service')
        .where('service.id = :serviceId', { serviceId })
        .setLock('pessimistic_write')
        .getOne();

      if (!service) {
        throw new NotFoundException(`Servicio con ID ${serviceId} no encontrado.`);
      }

      if (service.status !== ServiceStatus.DELIVERED) {
        throw new BadRequestException(
          'Solo se pueden enviar a facturar servicios con estado DELIVERED.',
        );
      }

      const existingPending = await transactionalEntityManager.findOne(BillingPending, {
        where: { serviceId },
      });

      if (existingPending) {
        throw new ConflictException('El servicio ya tiene un pendiente de facturación.');
      }

      const pending = transactionalEntityManager.create(BillingPending, {
        serviceId: service.id,
        status: PendingStatus.PENDING,
      });

      const savedPending = await transactionalEntityManager.save(pending);

      return {
        message: 'Servicio enviado a facturar correctamente.',
        pending: savedPending,
      };
    });
  }

  async getPendings(customerId?: number) {
    const query = this.pendingRepository
      .createQueryBuilder('pending')
      .leftJoinAndSelect('pending.service', 'service')
      .where('pending.status = :status', { status: PendingStatus.PENDING });

    if (customerId) {
      query.andWhere('service.customerId = :customerId', { customerId });
    }

    return query.getMany();
  }

  async getInvoices(batchId?: number) {
    return this.invoiceRepository.find({
      where: batchId ? { batchId } : {},
      relations: ['batch', 'pending', 'pending.service'],
      order: { id: 'ASC' },
    });
  }

  async createBatch(dto: CreateBatchDto) {
    if (!dto.pendingIds || dto.pendingIds.length === 0) {
      throw new BadRequestException('Debe incluir al menos un pendiente para facturar.');
    }

    return await this.dataSource.transaction(async (transactionalEntityManager) => {
      // 1. Bloqueo pesimista sobre billing_pendings usando innerJoinAndSelect para PostgreSQL
      const pendings = await transactionalEntityManager
        .createQueryBuilder(BillingPending, 'pending')
        .innerJoinAndSelect('pending.service', 'service')
        .where('pending.id IN (:...ids)', { ids: dto.pendingIds })
        .setLock('pessimistic_write', undefined, ['pending']) // <--- Bloquea SOLAMENTE la tabla billing_pendings
        .getMany();

      if (pendings.length !== dto.pendingIds.length) {
        throw new NotFoundException('Uno o más pendientes especificados no existen.');
      }

      // 2. Validar que ninguno esté ya facturado
      const alreadyInvoiced = pendings.some((p) => p.status === PendingStatus.INVOICED);
      if (alreadyInvoiced) {
        throw new ConflictException(
          'Uno o más pendientes seleccionados ya fueron facturados previamente.',
        );
      }

      // 3. Crear el Lote
      const batch = transactionalEntityManager.create(BillingBatch, {
        issueDate: dto.issueDate as any,
        receiptBook: dto.receiptBook,
        status: BatchStatus.PROCESSED,
      });
      const savedBatch = await transactionalEntityManager.save(batch);

      // 4. Bloquear la secuencia del talonario para evitar números duplicados en concurrencia.
      await transactionalEntityManager.query(
        `INSERT INTO "billing_sequences" ("receiptBook", "lastValue")
         VALUES ($1, 0)
         ON CONFLICT ("receiptBook") DO NOTHING`,
        [dto.receiptBook],
      );

      const sequenceRow = await transactionalEntityManager
        .createQueryBuilder(BillingSequence, 'sequence')
        .where('sequence.receiptBook = :receiptBook', { receiptBook: dto.receiptBook })
        .setLock('pessimistic_write')
        .getOne();

      let sequence = sequenceRow.lastValue;

      // 5. Generar Facturas y actualizar estado de los pendientes
      const createdInvoices: Invoice[] = [];

      for (const pending of pendings) {
        sequence++;
        const formattedCorrelative = String(sequence).padStart(8, '0');
        const invoiceNumber = `${dto.receiptBook}-${formattedCorrelative}`;

        const simulatedCAE = `CAE-${Math.floor(10000000000000 + Math.random() * 90000000000000)}`;

        const invoice = transactionalEntityManager.create(Invoice, {
          invoiceNumber,
          cae: simulatedCAE,
          issueDate: dto.issueDate as any,
          amount: Number(pending.service.amount),
          batch: savedBatch,
          pending: pending,
        });

        const savedInvoice = await transactionalEntityManager.save(invoice);
        createdInvoices.push(savedInvoice);

        // Marcar el pendiente como FACTURADO
        pending.status = PendingStatus.INVOICED;
        await transactionalEntityManager.save(pending);
      }

      sequenceRow.lastValue = sequence;
      await transactionalEntityManager.save(sequenceRow);

      return {
        batch: savedBatch,
        totalInvoices: createdInvoices.length,
        invoices: createdInvoices,
      };
    });
  }

  async getBatchExportFormat(batchId: number) {
    const batch = await this.batchRepository.findOne({
      where: { id: batchId },
      relations: ['invoices', 'invoices.pending', 'invoices.pending.service'],
    });

    if (!batch) {
      throw new NotFoundException(`Lote con ID ${batchId} no encontrado.`);
    }

    return {
      erpHeader: {
        batchId: batch.id,
        processedAt: batch.createdAt,
        receiptBook: batch.receiptBook,
        totalRecords: batch.invoices.length,
      },
      accountingEntries: batch.invoices.map((inv) => ({
        externalInvoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        cae: inv.cae,
        issueDate: inv.issueDate,
        customerId: inv.pending.service.customerId,
        amount: Number(inv.amount),
        serviceReferenceId: inv.pending.serviceId,
      })),
    };
  }

  async syncBatch(batchId: number) {
    return this.dataSource.transaction(async (transactionalEntityManager) => {
      const batch = await transactionalEntityManager
        .createQueryBuilder(BillingBatch, 'batch')
        .leftJoinAndSelect('batch.invoices', 'invoice')
        .leftJoinAndSelect('invoice.pending', 'pending')
        .leftJoinAndSelect('pending.service', 'service')
        .where('batch.id = :batchId', { batchId })
        .setLock('pessimistic_write')
        .getOne();

      if (!batch) {
        throw new NotFoundException(`Lote con ID ${batchId} no encontrado.`);
      }

      if (batch.syncStatus === SyncStatus.SYNCED) {
        return {
          status: SyncStatus.SYNCED,
          batchId: batch.id,
          syncedAt: batch.syncedAt,
          totalRecords: batch.invoices.length,
          message: 'El lote ya fue sincronizado previamente.',
        };
      }

      batch.syncStatus = SyncStatus.SYNCED;
      batch.syncedAt = new Date();
      const savedBatch = await transactionalEntityManager.save(batch);

      return {
        status: SyncStatus.SYNCED,
        batchId: savedBatch.id,
        syncedAt: savedBatch.syncedAt,
        totalRecords: savedBatch.invoices.length,
        payload: {
          erpHeader: {
            batchId: savedBatch.id,
            processedAt: savedBatch.createdAt,
            receiptBook: savedBatch.receiptBook,
            totalRecords: savedBatch.invoices.length,
          },
          accountingEntries: savedBatch.invoices.map((invoice) => ({
            externalInvoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            cae: invoice.cae,
            issueDate: invoice.issueDate,
            customerId: invoice.pending.service.customerId,
            amount: Number(invoice.amount),
            serviceReferenceId: invoice.pending.serviceId,
          })),
        },
      };
    });
  }
}