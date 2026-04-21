import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import type { Request, Response, NextFunction } from 'express';

jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
}));

function createMockResponse(): Response {
  return {
    sendFile: jest.fn(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  } as unknown as Response;
}

function createMockRequest(path: string): Request {
  return { path } as Request;
}

describe('AppController', () => {
  let appController: AppController;
  let mockRes: Response;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
    mockRes = createMockResponse();
  });

  describe('serveIndex', () => {
    it('should send index.html for root path', () => {
      appController.serveIndex(createMockRequest('/'), mockRes);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRes.sendFile).toHaveBeenCalled();
    });
  });

  describe('serveSpa', () => {
    it('should call next for /api paths', () => {
      const mockNext = jest.fn() as unknown as NextFunction;
      appController.serveSpa(
        createMockRequest('/api/auth/login'),
        mockRes,
        mockNext,
      );
      expect(mockNext).toHaveBeenCalled();
    });

    it('should send index.html for SPA routes', () => {
      const mockNext = jest.fn() as unknown as NextFunction;
      appController.serveSpa(createMockRequest('/login'), mockRes, mockNext);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRes.sendFile).toHaveBeenCalled();
    });
  });
});
