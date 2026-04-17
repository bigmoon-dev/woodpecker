import { Injectable } from '@nestjs/common';
import { spawn } from 'child_process';

@Injectable()
export class OcrService {
  static mockMode = false;

  async recognize(
    filePath: string,
  ): Promise<{ text: string; confidence: number }> {
    if (OcrService.mockMode) {
      return { text: 'mocked ocr result', confidence: 0.95 };
    }

    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.runOcr(filePath);
      } catch (err) {
        lastError = err as Error;
      }
    }

    throw lastError ?? new Error('OCR failed after retries');
  }

  private runOcr(
    filePath: string,
  ): Promise<{ text: string; confidence: number }> {
    return new Promise((resolve, reject) => {
      const proc = spawn('python3', [
        '-m',
        'paddleocr',
        '--image_dir',
        filePath,
        '--use_angle_cls',
        'true',
        '--use_gpu',
        'false',
        '--lang',
        'ch',
      ]);

      const timeout = setTimeout(() => {
        proc.kill();
        reject(new Error('OCR timeout'));
      }, 30000);

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve({ text: stdout, confidence: 0.9 });
        } else {
          reject(new Error(`OCR failed: ${stderr}`));
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  isAvailable(): boolean {
    if (OcrService.mockMode) return true;

    /* eslint-disable @typescript-eslint/no-require-imports */
    const childProcess =
      require('child_process') as typeof import('child_process');
    /* eslint-enable @typescript-eslint/no-require-imports */
    const { execSync } = childProcess;
    try {
      execSync('which python3', { stdio: 'ignore' });
      execSync('python3 -c "import paddleocr"', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }
}
