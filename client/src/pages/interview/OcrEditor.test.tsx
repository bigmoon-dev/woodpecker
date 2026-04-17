import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OcrEditor from './OcrEditor';

vi.mock('../../utils/request', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('antd', async () => {
  const actual = await vi.importActual('antd');
  return { ...actual, message: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } };
});

import request from '../../utils/request';
import { message } from 'antd';

describe('OcrEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (request.put as any).mockResolvedValue({});
    (request.get as any).mockResolvedValue({ data: [{ id: 'f1' }] });
    (request.post as any).mockResolvedValue({});
  });

  it('renders textarea with OCR text', () => {
    render(<OcrEditor interviewId="iv-1" ocrText="这是OCR识别的文本" onSave={vi.fn()} />);
    expect(screen.getByDisplayValue('这是OCR识别的文本')).toBeInTheDocument();
  });

  it('allows editing and saving', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(<OcrEditor interviewId="iv-1" ocrText="原始文本" onSave={onSave} />);

    const textarea = screen.getByDisplayValue('原始文本');
    await user.clear(textarea);
    await user.type(textarea, '修改后的文本');

    await user.click(screen.getByRole('button', { name: /保\s*存/ }));
    await waitFor(() => {
      expect(request.put).toHaveBeenCalledWith('/interviews/iv-1', expect.objectContaining({ ocrText: '修改后的文本' }));
      expect(message.success).toHaveBeenCalledWith('保存成功');
      expect(onSave).toHaveBeenCalledWith('修改后的文本');
    });
  });

  it('shows empty state when no OCR text', () => {
    render(<OcrEditor interviewId="iv-1" ocrText={null} onSave={vi.fn()} />);
    expect(screen.getByText('暂无OCR文本')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /重新OCR/ })).toBeInTheDocument();
  });

  it('clicks re-OCR button with files', async () => {
    const user = userEvent.setup();
    render(<OcrEditor interviewId="iv-1" ocrText={null} onSave={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /重新OCR/ }));
    await waitFor(() => {
      expect(request.get).toHaveBeenCalledWith('/interviews/iv-1/files');
      expect(request.post).toHaveBeenCalledWith('/interviews/iv-1/files/f1/ocr');
      expect(message.success).toHaveBeenCalledWith('已触发重新OCR，请稍后刷新');
    });
  });

  it('shows warning when no files for re-OCR', async () => {
    (request.get as any).mockResolvedValue({ data: [] });
    const user = userEvent.setup();
    render(<OcrEditor interviewId="iv-1" ocrText={null} onSave={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /重新OCR/ }));
    await waitFor(() => {
      expect(message.warning).toHaveBeenCalledWith('没有可OCR的文件');
    });
  });

  it('shows error on save failure', async () => {
    (request.put as any).mockRejectedValueOnce(new Error('fail'));
    const user = userEvent.setup();
    render(<OcrEditor interviewId="iv-1" ocrText="文本" onSave={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /保\s*存/ }));
    await waitFor(() => {
      expect(message.error).toHaveBeenCalledWith('保存失败');
    });
  });

  it('shows error on re-OCR failure', async () => {
    (request.get as any).mockRejectedValueOnce(new Error('fail'));
    const user = userEvent.setup();
    render(<OcrEditor interviewId="iv-1" ocrText={null} onSave={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /重新OCR/ }));
    await waitFor(() => {
      expect(message.error).toHaveBeenCalledWith('重新OCR失败');
    });
  });

  it('updates text when ocrText prop changes', () => {
    const { rerender } = render(<OcrEditor interviewId="iv-1" ocrText="初始" onSave={vi.fn()} />);
    expect(screen.getByDisplayValue('初始')).toBeInTheDocument();

    rerender(<OcrEditor interviewId="iv-1" ocrText="更新后的文本" onSave={vi.fn()} />);
    expect(screen.getByDisplayValue('更新后的文本')).toBeInTheDocument();
  });
});
