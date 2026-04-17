/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { Injectable } from '@nestjs/common';
import { spawn } from 'child_process';

const OCR_PYTHON = process.env.OCR_PYTHON || 'python3.9';
const OCR_TIMEOUT = parseInt(process.env.OCR_TIMEOUT || '60000', 10);

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
      const script = [
        'from paddleocr import PaddleOCR',
        'import json, sys',
        'ocr = PaddleOCR(use_angle_cls=True, lang="ch", use_gpu=False, show_log=False)',
        'result = ocr.ocr(sys.argv[1], cls=True)',
        'lines = []',
        'total_conf = 0',
        'count = 0',
        'for page in result:',
        '    if page:',
        '        for line in page:',
        '            lines.append(line[1][0])',
        '            total_conf += line[1][1]',
        '            count += 1',
        'avg_conf = total_conf / count if count > 0 else 0',
        'print(json.dumps({"text": "\\n".join(lines), "confidence": avg_conf}))',
      ].join('\n');

      const proc = spawn(OCR_PYTHON, ['-c', script, filePath]);

      const timeout = setTimeout(() => {
        proc.kill();
        reject(new Error('OCR timeout'));
      }, OCR_TIMEOUT);

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
          try {
            const jsonLine = stdout
              .split('\n')
              .find((l) => l.trim().startsWith('{'));
            if (jsonLine) {
              const parsed = JSON.parse(jsonLine);
              resolve({
                text: parsed.text,
                confidence: parsed.confidence,
              });
            } else {
              resolve({ text: stdout, confidence: 0.9 });
            }
          } catch {
            resolve({ text: stdout, confidence: 0.9 });
          }
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
      execSync(`which ${OCR_PYTHON}`, { stdio: 'ignore' });
      execSync(`${OCR_PYTHON} -c "from paddleocr import PaddleOCR"`, {
        stdio: 'ignore',
      });
      return true;
    } catch {
      return false;
    }
  }
}
