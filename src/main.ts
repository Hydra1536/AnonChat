import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './shared/http-exception.filter';
import { ResponseEnvelopeInterceptor } from './shared/response-envelope.interceptor';
import { validationExceptionFactory } from './shared/validation-exception.factory';
import { RedisIoAdapter } from './websocket/redis-io.adapter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis();

  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: process.env.APP_ORIGIN ?? '*' });
  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      exceptionFactory: validationExceptionFactory,
    }),
  );
  app.useWebSocketAdapter(redisIoAdapter);

  await app.listen(Number(process.env.PORT ?? 3000));
}

void bootstrap();
