import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import helmet from 'helmet';  // SECURITY: Secure HTTP headers

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // SECURITY: Add secure HTTP headers (XSS protection, no-sniff, etc.)
  app.use(helmet());
  
  // Enable global validation
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));
  
  // SECURITY: Properly configured CORS
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  
  await app.listen(process.env.PORT ?? 3000);
  console.log(`🚀 Application running on: http://localhost:${process.env.PORT ?? 3000}`);
}
bootstrap();
