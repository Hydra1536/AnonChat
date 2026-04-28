import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';

@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((payload) => {
        if (
          typeof payload === 'object' &&
          payload !== null &&
          'success' in payload &&
          typeof (payload as { success?: unknown }).success === 'boolean'
        ) {
          return payload;
        }

        return {
          success: true,
          data: payload ?? {},
        };
      }),
    );
  }
}
