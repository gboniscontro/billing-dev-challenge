import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingPending, PendingStatus } from '../entities/billing-pending.entity';
import { ServiceStatus } from '../entities/service.entity';

describe('BillingService', () => {
  const pendingRepository = {} as any;
  const batchRepository = {} as any;
  const invoiceRepository = {} as any;
  const serviceRepository = {} as any;
  let dataSource: any;
  let billingService: BillingService;

  beforeEach(() => {
    dataSource = {
      transaction: jest.fn(),
    };
    billingService = new BillingService(
      pendingRepository,
      batchRepository,
      invoiceRepository,
      serviceRepository,
      dataSource,
    );
  });

  it('rechaza crear un lote sin pendientes', async () => {
    await expect(
      billingService.createBatch({
        receiptBook: '0001',
        issueDate: '2026-08-23',
        pendingIds: [],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rechaza enviar a facturar un servicio inexistente', async () => {
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    };
    const manager = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    dataSource.transaction.mockImplementation((callback) => callback(manager));

    await expect(billingService.sendServiceToBilling(99)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rechaza enviar a facturar un servicio que no esta entregado', async () => {
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({ id: 4, status: ServiceStatus.IN_TRANSIT }),
    };
    const manager = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    dataSource.transaction.mockImplementation((callback) => callback(manager));

    await expect(billingService.sendServiceToBilling(4)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('crea un pendiente PENDING para un servicio DELIVERED', async () => {
    const service = { id: 1, status: ServiceStatus.DELIVERED };
    const pending = { serviceId: 1, status: PendingStatus.PENDING };
    const savedPending = { id: 10, ...pending };
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(service),
    };
    const manager = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockReturnValue(pending),
      save: jest.fn().mockResolvedValue(savedPending),
    };
    dataSource.transaction.mockImplementation((callback) => callback(manager));

    await expect(billingService.sendServiceToBilling(1)).resolves.toEqual({
      message: 'Servicio enviado a facturar correctamente.',
      pending: savedPending,
    });
    expect(manager.create).toHaveBeenCalledWith(BillingPending, {
      serviceId: 1,
      status: PendingStatus.PENDING,
    });
    expect(manager.save).toHaveBeenCalledWith(pending);
  });

  it('rechaza duplicar el pendiente de un servicio', async () => {
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({ id: 1, status: ServiceStatus.DELIVERED }),
    };
    const manager = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      findOne: jest.fn().mockResolvedValue({ id: 10, serviceId: 1 }),
    };
    dataSource.transaction.mockImplementation((callback) => callback(manager));

    await expect(billingService.sendServiceToBilling(1)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
