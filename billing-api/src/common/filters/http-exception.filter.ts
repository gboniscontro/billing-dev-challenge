import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

export type ErrorDetails = string[] | Record<string, unknown> | null;

export interface ErrorResponse {
  statusCode: number;
  code: string;
  message: string;
  details: ErrorDetails;
  timestamp: string;
  path: string;
}

const ERROR_CODES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'VALIDATION_ERROR',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_SERVER_ERROR',
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const timestamp = new Date().toISOString();

    const errorResponse = this.buildErrorResponse(exception, request, timestamp);

    if (errorResponse.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} failed with ${errorResponse.statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(errorResponse.statusCode).json(errorResponse);
  }

  private buildErrorResponse(
    exception: unknown,
    request: Request,
    timestamp: string,
  ): ErrorResponse {
    if (!(exception instanceof HttpException)) {
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Ocurrió un error interno. Intente nuevamente más tarde.',
        details: null,
        timestamp,
        path: request.url,
      };
    }

    const statusCode = exception.getStatus();
    const exceptionResponse = exception.getResponse();
    const responseObject =
      typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? (exceptionResponse as Record<string, unknown>)
        : null;
    const rawMessage = responseObject?.message ?? exceptionResponse;
    const isValidationMessage = Array.isArray(rawMessage);
    const details = isValidationMessage
      ? rawMessage.filter((item): item is string => typeof item === 'string')
      : null;
    const message = isValidationMessage
      ? 'La solicitud contiene datos inválidos.'
      : typeof rawMessage === 'string'
        ? rawMessage
        : exception.message;
    const code =
      typeof responseObject?.code === 'string'
        ? responseObject.code
        : isValidationMessage
          ? 'VALIDATION_ERROR'
          : ERROR_CODES[statusCode] ?? 'HTTP_ERROR';

    return {
      statusCode,
      code,
      message,
      details,
      timestamp,
      path: request.url,
    };
  }
}
