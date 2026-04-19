import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/http-exception.filter';
import * as express from 'express';
import { join } from 'path';
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

  const publicDir = join(__dirname, '..', 'public');
  app.use(express.static(publicDir));

  app.use(
    (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      if (
        req.method === 'GET' &&
        !req.path.startsWith('/api') &&
        !req.path.startsWith('/health')
      ) {
        res.sendFile(join(publicDir, 'index.html'));
        return;
      }
      next();
    },
  );

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
