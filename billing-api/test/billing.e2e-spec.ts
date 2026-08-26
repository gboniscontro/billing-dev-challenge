import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

describe('Billing API integration', () => {
  let app: INestApplication;
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('responde el health check publico', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);

    expect(response.body.status).toBe('ok');
  });

  it('permite iniciar sesion y devuelve un JWT', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'integration-test', password: 'test' })
      .expect(201);

    expect(response.body.accessToken).toEqual(expect.any(String));
    accessToken = response.body.accessToken;
  });

  it('rechaza consultar pendientes sin token', async () => {
    await request(app.getHttpServer()).get('/billing/pendings').expect(401);
  });

  it('consulta pendientes con un token valido', async () => {
    const response = await request(app.getHttpServer())
      .get('/billing/pendings')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toEqual(expect.any(Array));
  });

  it('rechaza crear un lote sin pendientes', async () => {
    const response = await request(app.getHttpServer())
      .post('/billing/batches')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        receiptBook: '0001',
        issueDate: '2026-08-23',
        pendingIds: [],
      })
      .expect(400);

    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(response.body.message).toBe('La solicitud contiene datos inválidos.');
    expect(response.body.details).toEqual(expect.arrayContaining([expect.any(String)]));
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('path', '/billing/batches');
  });

  it('rechaza un filtro de cliente que no es numérico', async () => {
    const response = await request(app.getHttpServer())
      .get('/billing/pendings?customerId=abc')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(400);

    expect(response.body).toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'La solicitud contiene datos inválidos.',
    });
    expect(response.body.details).toEqual(expect.arrayContaining([expect.any(String)]));
  });

  it('rechaza un identificador de lote que no es numérico', async () => {
    const response = await request(app.getHttpServer())
      .get('/billing/batches/abc/export')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(400);

    expect(response.body.code).toBe('BAD_REQUEST');
  });

  it('rechaza exportar un lote inexistente', async () => {
    const response = await request(app.getHttpServer())
      .get('/billing/batches/999999/export')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);

    expect(response.body).toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });
});
