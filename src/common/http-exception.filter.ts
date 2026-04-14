import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
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
