import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DataSource } from 'typeorm';
import { Service, ServiceStatus } from './entities/service.entity';
import { BillingPending, PendingStatus } from './entities/billing-pending.entity';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  console.log('🌱 Iniciando seeding de datos de prueba...');

  try {
    // 1. Limpieza total y reinicio de IDs desde 1
    await dataSource.query(
      'TRUNCATE TABLE "invoices", "billing_batches", "billing_pendings", "services", "billing_sequences" RESTART IDENTITY CASCADE;',
    );

    // 2. Crear Servicios Logísticos con serviceDate explícito
    const serviceRepository = dataSource.getRepository(Service);
    const services = serviceRepository.create([
      {
        serviceDate: new Date(),
        customerId: 101,
        amount: 15000.50,
        status: ServiceStatus.DELIVERED,
      },
      {
        serviceDate: new Date(),
        customerId: 101,
        amount: 22000.00,
        status: ServiceStatus.DELIVERED,
      },
      {
        serviceDate: new Date(),
        customerId: 102,
        amount: 8500.75,
        status: ServiceStatus.DELIVERED,
      },
      {
        serviceDate: new Date(),
        customerId: 103,
        amount: 45000.00,
        status: ServiceStatus.IN_TRANSIT, // No genera pendiente
      },
    ]);

    const savedServices = await serviceRepository.save(services);

    // 3. Crear Pendientes de Facturación para los entregados
    const pendingRepository = dataSource.getRepository(BillingPending);
    const pendings = pendingRepository.create(
      savedServices
        .filter((s) => s.status === ServiceStatus.DELIVERED)
        .map((s) => ({
          serviceId: s.id,
          status: PendingStatus.PENDING,
        })),
    );

    await pendingRepository.save(pendings);

    console.log('✅ Seed completado con éxito.');
  } catch (error) {
    console.error('❌ Error ejecutando el seed:', error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

bootstrap();