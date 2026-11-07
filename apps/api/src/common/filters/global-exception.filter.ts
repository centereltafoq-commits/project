import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppLoggerService } from '../logger/app-logger.service';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'حدث خطأ غير متوقع في الخادم، يرجى المحاولة مرة أخرى';
    let validationErrors: string[] | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const rawResponse = exception.getResponse();
      if (typeof rawResponse === 'string') {
        message = rawResponse;
      } else if (typeof rawResponse === 'object' && rawResponse !== null) {
        const body = rawResponse as Record<string, unknown>;
        if (Array.isArray(body.message)) {
          validationErrors = body.message.map(String);
          message = validationErrors[0] || 'بيانات المدخلات غير صالحة';
        } else if (typeof body.message === 'string') {
          message = body.message;
        }
      }
    } else if (exception instanceof Error) {
      this.logger.error('Unhandled server exception', exception.stack, {
        path: request.url,
        method: request.method,
      });
    }

    if (status >= 500 && exception instanceof HttpException) {
      this.logger.error(message, undefined, { path: request.url, status });
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      ...(validationErrors ? { errors: validationErrors } : {}),
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}

