import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';
import { AppException } from './app-exception';
import { ERROR_CODES } from './error-codes';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'Internal server error';

    if (exception instanceof AppException) {
      status = exception.getStatus();
      code = exception.code;
      message = exception.message;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      message = this.extractMessage(exception);

      if (status === HttpStatus.UNAUTHORIZED) {
        code = ERROR_CODES.UNAUTHORIZED;
      } else if (status === HttpStatus.FORBIDDEN) {
        code = ERROR_CODES.FORBIDDEN;
      } else if (status === HttpStatus.BAD_REQUEST) {
        code = ERROR_CODES.VALIDATION_ERROR;
      } else {
        code = 'HTTP_ERROR';
      }
      this.logger.error(message, exception.stack);
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
    } else {
      this.logger.error('Unknown error thrown');
    }

    response.status(status).json({
      success: false,
      error: {
        code,
        message,
      },
    });
  }

  private extractMessage(exception: HttpException): string {
    const body = exception.getResponse();
    if (typeof body === 'string') {
      return body;
    }

    if (typeof body === 'object' && body !== null) {
      const maybeMessage = (body as Record<string, unknown>).message;
      if (Array.isArray(maybeMessage)) {
        return maybeMessage.join(', ');
      }

      if (typeof maybeMessage === 'string') {
        return maybeMessage;
      }
    }

    return exception.message;
  }
}
