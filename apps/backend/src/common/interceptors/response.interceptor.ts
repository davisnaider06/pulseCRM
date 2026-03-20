import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { map, Observable } from 'rxjs';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, unknown> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Record<string, unknown>> {
    const request = context.switchToHttp().getRequest<Request>();

    return (next.handle() as Observable<T>).pipe(
      map((data: T) => ({
        success: true,
        path: request.url,
        timestamp: new Date().toISOString(),
        data,
      })),
    );
  }
}
