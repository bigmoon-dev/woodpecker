import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/http-exception.filter';
import * as path from 'path';
import * as crypto from 'crypto';

const DEFAULT_SECRETS = [
  'change-this-to-a-secure-random-string-in-production',
  'woodpecker-desktop-jwt-secret',
];

if (
  !process.env.JWT_SECRET ||
  DEFAULT_SECRETS.includes(process.env.JWT_SECRET)
) {
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useStaticAssets(path.join(__dirname, '..', 'public'));
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
