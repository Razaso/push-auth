import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import { WINSTON_MODULE_PROVIDER, WinstonModule } from 'nest-winston';
import { loggerConfig } from './logger/config';
import { PrismaExceptionFilter } from './prisma/prisma-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger(loggerConfig),
  });

  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: 'OPTIONS,GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: 'Content-Type, Accept, Authorization',
  });

  // Use cookie parser middleware
  app.use(cookieParser());
  app.useGlobalFilters(new PrismaExceptionFilter(app.get(WINSTON_MODULE_PROVIDER)));

  const config = new DocumentBuilder()
    .setTitle('Push-Auth API')
    .setDescription('API documentation for Push-Auth project')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
