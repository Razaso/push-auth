import { ExceptionFilter, Catch, ArgumentsHost } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { Inject } from '@nestjs/common';

@Catch(Prisma.PrismaClientValidationError, Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  catch(exception: Prisma.PrismaClientValidationError | Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    let statusCode = 500;
    let message = 'Internal server error';

    const logContext = {
      path: request.url,
      method: request.method,
      body: request.body,
      query: request.query,
      params: request.params,
      headers: {
        ...request.headers,
        authorization: request.headers.authorization ? '[REDACTED]' : undefined,
      },
      timestamp: new Date().toISOString(),
      requestId: request.id, // If you have request ID middleware
    };

    if (exception instanceof Prisma.PrismaClientValidationError) {
      statusCode = 400;
      message = 'Validation error';
      this.logger.error('Prisma validation error occurred', {
        ...logContext,
        error: {
          name: exception.name,
          message: exception.message,
          stack: exception.stack,
        },
      });
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const errorMeta = {
        code: exception.code,
        meta: exception.meta,
        target: exception.meta?.target || [],
      };

      switch (exception.code) {
        case 'P2002':
          statusCode = 409;
          message = 'Unique constraint violation';
          break;
        case 'P2025':
          statusCode = 404;
          message = 'Record not found';
          break;
        case 'P2014':
          statusCode = 400;
          message = 'Invalid ID or reference';
          break;
        case 'P2003':
          statusCode = 400;
          message = 'Foreign key constraint failed';
          break;
        default:
          statusCode = 500;
          message = 'Database operation failed';
      }

      this.logger.error('Prisma known request error occurred', {
        ...logContext,
        error: {
          name: exception.name,
          message: exception.message,
          stack: exception.stack,
          ...errorMeta,
        },
      });
    }

    // Log the response being sent
    this.logger.debug('Sending error response', {
      ...logContext,
      response: {
        statusCode,
        message,
      },
    });

    response.status(statusCode).json({
      statusCode,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}