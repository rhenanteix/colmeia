import { Logger } from 'nestjs-pino';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './module';
async function bootstrap() {
  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret || secret.length < 32)
    throw new Error('AUTH_JWT_SECRET must be at least 32 characters');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: (process.env.WEB_ORIGIN || 'http://localhost:3000').split(','),
    credentials: false,
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  const doc = new DocumentBuilder()
    .setTitle('Colmeia API')
    .setVersion('0.2.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, doc));
  await app.listen(Number(process.env.API_PORT || 4000), '0.0.0.0');
}
bootstrap().catch((error) => {
  console.error('Colmeia API startup failed', error);
  process.exitCode = 1;
});
