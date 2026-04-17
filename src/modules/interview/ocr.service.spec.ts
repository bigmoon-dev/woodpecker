/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-require-imports */
import { OcrService } from './ocr.service';

jest.mock('child_process', () => ({
  spawn: jest.fn(),
  execSync: jest.fn(),
}));

import { spawn } from 'child_process';

describe('OcrService', () => {
  let service: OcrService;

  beforeEach(() => {
    service = new OcrService();
    OcrService.mockMode = false;
    jest.clearAllMocks();
  });

  afterEach(() => {
    OcrService.mockMode = false;
  });

  describe('recognize', () => {
    it('should return mocked result in mock mode', async () => {
      OcrService.mockMode = true;

      const result = await service.recognize('/path/to/image.png');

      expect(result.text).toBe('mocked ocr result');
      expect(result.confidence).toBe(0.95);
    });

    it('should retry up to 3 times on failure', async () => {
      let callCount = 0;
      (spawn as jest.Mock).mockImplementation(() => {
        callCount++;
        return {
          stdout: { on: jest.fn() },
          stderr: {
            on: jest.fn((_: string, cb: any) => cb(Buffer.from('err'))),
          },
          on: jest.fn((event: string, cb: any) => {
            if (event === 'close') setTimeout(() => cb(1), 0);
          }),
          kill: jest.fn(),
        };
      });

      await expect(service.recognize('/path/to/image.png')).rejects.toThrow(
        'OCR failed',
      );
      expect(callCount).toBe(3);
    }, 10000);

    it('should resolve on successful OCR', async () => {
      (spawn as jest.Mock).mockImplementation(() => {
        return {
          stdout: {
            on: jest.fn((event: string, cb: any) => {
              if (event === 'data') cb(Buffer.from('ocr text'));
            }),
          },
          stderr: { on: jest.fn() },
          on: jest.fn((event: string, cb: any) => {
            if (event === 'close') setTimeout(() => cb(0), 0);
          }),
          kill: jest.fn(),
        };
      });

      const result = await service.recognize('/path/to/image.png');
      expect(result.text).toContain('ocr text');
      expect(result.confidence).toBe(0.9);
    });

    it('should reject on spawn error', async () => {
      (spawn as jest.Mock).mockImplementation(() => {
        return {
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn((event: string, cb: any) => {
            if (event === 'error')
              setTimeout(() => cb(new Error('spawn error')), 0);
          }),
          kill: jest.fn(),
        };
      });

      await expect(service.recognize('/path/to/image.png')).rejects.toThrow(
        'spawn error',
      );
    }, 10000);
  });

  describe('isAvailable', () => {
    it('should return true in mock mode', () => {
      OcrService.mockMode = true;
      expect(service.isAvailable()).toBe(true);
    });

    it('should return false when execSync throws', () => {
      const { execSync } = require('child_process');
      (execSync as jest.Mock).mockImplementation(() => {
        throw new Error('not found');
      });

      expect(service.isAvailable()).toBe(false);
    });

    it('should return true when python3 and paddleocr are available', () => {
      const { execSync } = require('child_process');
      (execSync as jest.Mock).mockReturnValue('');

      expect(service.isAvailable()).toBe(true);
    });
  });
});
