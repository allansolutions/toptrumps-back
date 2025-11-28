import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  try {
    const app = await NestFactory.create(AppModule);
    const port = process.env.PORT ?? 3000;

    // Configurar CORS (ya configurado en gateway, pero para REST también)
    app.enableCors({
      origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
      credentials: true,
    });

    // Configurar ValidationPipe global
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true, // Elimina propiedades no definidas en DTO
        forbidNonWhitelisted: true, // Lanza error si hay propiedades extra
        transform: true, // Transforma payloads a instancias de DTO
        transformOptions: {
          enableImplicitConversion: true, // Convierte tipos automáticamente
        },
      }),
    );

    // Configurar Swagger/OpenAPI Documentation
    const config = new DocumentBuilder()
      .setTitle('Top Trumps API')
      .setDescription(
        'Real-time multiplayer Top Trumps game API with WebSocket support',
      )
      .setVersion('1.0')
      .addTag('cards', 'Card management endpoints')
      .addTag('game', 'Game management endpoints')
      .addTag('players', 'Player management endpoints')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);

    await app.listen(port);
    logger.log(`Application is running on: http://localhost:${port}`);
    logger.log(`Swagger documentation: http://localhost:${port}/api`);
  } catch (error) {
    logger.error('Failed to start application', error);
    process.exit(1);
  }
}

void bootstrap();
