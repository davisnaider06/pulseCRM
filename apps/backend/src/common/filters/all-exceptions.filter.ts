import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    const message =
      typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? exceptionResponse
        : {
            message:
              exception instanceof Error
                ? exception.message
                : 'Erro interno do servidor.',
          };

    if (status >= 500) {
      this.logger.error(
        `Request failed: ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).json({
      success: false,
      message:
        typeof message === 'object' && message !== null && 'message' in message
          ? message.message
          : 'Nao foi possivel processar a solicitacao.',
      error: message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
