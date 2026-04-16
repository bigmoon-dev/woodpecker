import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { join } from 'path';
import { existsSync } from 'fs';

const indexHtmlPath = (() => {
  const p = join(__dirname, '..', 'public', 'index.html');
  return existsSync(p) ? p : null;
})();

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    if (
      status === 404 &&
      request.method === 'GET' &&
      !request.path.startsWith('/api') &&
      !request.path.startsWith('/health') &&
      indexHtmlPath
    ) {
      response.sendFile(indexHtmlPath);
      return;
    }

    const resp =
      exception instanceof HttpException ? exception.getResponse() : null;
    let message = 'Internal server error';
    if (exception instanceof HttpException) {
      if (typeof resp === 'string') {
        message = resp;
      } else {
        const msgValue = (resp as Record<string, unknown>).message;
        if (Array.isArray(msgValue)) {
          message = (msgValue as string[]).join('; ');
        } else if (typeof msgValue === 'string') {
          message = msgValue;
        } else {
          message = exception.message;
        }
      }
    }
    response.status(status).json({ code: status, message, detail: null });
  }
}
