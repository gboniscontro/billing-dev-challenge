import { ArgumentsHost, BadRequestException, NotFoundException } from '@nestjs/common';
import { Request, Response } from 'express';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  const createHost = () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const response = { status } as unknown as Response;
    const request = { method: 'GET', url: '/billing/pendings' } as Request;

    return {
      host: {
        switchToHttp: () => ({
          getResponse: () => response,
          getRequest: () => request,
        }),
      } as ArgumentsHost,
      status,
      json,
    };
  };

  it('normaliza una excepción HTTP de dominio', () => {
    const filter = new HttpExceptionFilter();
    const { host, status, json } = createHost();

    filter.catch(new NotFoundException('Lote no encontrado.'), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Lote no encontrado.',
        details: null,
        path: '/billing/pendings',
      }),
    );
  });

  it('convierte los mensajes de validación en detalles estructurados', () => {
    const filter = new HttpExceptionFilter();
    const { host, json } = createHost();

    filter.catch(new BadRequestException(['receiptBook must be a string']), host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'La solicitud contiene datos inválidos.',
        details: ['receiptBook must be a string'],
      }),
    );
  });

  it('oculta los detalles de errores inesperados', () => {
    const filter = new HttpExceptionFilter();
    const { host, status, json } = createHost();

    filter.catch(new Error('database password leaked'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Ocurrió un error interno. Intente nuevamente más tarde.',
        details: null,
      }),
    );
    expect(JSON.stringify(json.mock.calls[0][0])).not.toContain('database password leaked');
  });
});