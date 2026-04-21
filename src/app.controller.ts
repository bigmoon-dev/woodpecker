import { Controller, Get, Req, Res, Next } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { join } from 'path';
import { existsSync } from 'fs';
import { AppService } from './app.service';
import { Public } from './modules/auth/public.decorator';

const PUBLIC_DIRS = [
  join(__dirname, '..', 'public'),
  join(__dirname, '..', '..', 'public'),
];

function findPublicDir(): string | null {
  for (const d of PUBLIC_DIRS) {
    if (existsSync(join(d, 'index.html'))) return d;
  }
  return null;
}

@Controller()
@Public()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  serveIndex(@Req() req: Request, @Res() res: Response): void {
    const publicDir = findPublicDir();
    if (publicDir) {
      res.sendFile(join(publicDir, 'index.html'));
    } else {
      res.status(404).json({ code: 404, message: 'index.html not found' });
    }
  }

  @Get('{*path}')
  serveSpa(
    @Req() req: Request,
    @Res() res: Response,
    @Next() next: NextFunction,
  ): void {
    const path = req.path;
    if (path.startsWith('/api') || path.startsWith('/health')) {
      return next();
    }

    const publicDir = findPublicDir();
    if (!publicDir) {
      return next();
    }

    if (path.includes('.')) {
      const filePath = join(publicDir, path);
      if (existsSync(filePath)) {
        res.sendFile(filePath);
        return;
      }
      return next();
    }

    res.sendFile(join(publicDir, 'index.html'));
  }
}
