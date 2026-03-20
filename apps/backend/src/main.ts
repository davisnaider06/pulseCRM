import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { PrismaService } from './database/prisma.service';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const prismaService = app.get(PrismaService);

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: configService.get<string>('app.frontendUrl'),
    credentials: true,
  });
  app.use(helmet());
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  app.use(cookieParser() as Parameters<typeof app.use>[0]);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: false,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('CRM API')
    .setDescription('API REST do CRM comercial')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  prismaService.enableShutdownHooks(app);

  const port = configService.get<number>('app.port') ?? 3001;

  try {
    await app.listen(port);
  } catch (error) {
    await app.close();

    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'EADDRINUSE'
    ) {
      logger.error(
        `Port ${port} is already in use. Another backend instance may already be running. Stop the existing process or set BACKEND_PORT to a different value before starting this app.`,
      );
      process.exit(1);
    }

    throw error;
  }
}

void bootstrap();
