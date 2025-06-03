import * as dotenv from 'dotenv';
dotenv.config(); // Load .env file at the very beginning

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(8001);
}
bootstrap();
