import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FileUpload from './FileUpload';

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

const mockFiles = [
  { id: 'f1', originalName: '访谈记录.pdf', ocrStatus: 'done', createdAt: '2024-01-15T10:00:00.000Z' },
  { id: 'f2', originalName: '照片.jpg', ocrStatus: 'pending', createdAt: '2024-01-16T14:00:00.000Z' },
  { id: 'f3', originalName: '扫描件.png', ocrStatus: 'failed', createdAt: '2024-01-17T08:00:00.000Z' },
];

describe('FileUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (request.get as any).mockResolvedValue({ data: mockFiles });
    (request.post as any).mockResolvedValue({});
    (request.delete as any).mockResolvedValue({});
  });

  it('renders upload area', async () => {
    render(<FileUpload interviewId="iv-1" />);
    await waitFor(() => {
      expect(screen.getByText('点击或拖拽文件到此区域上传')).toBeInTheDocument();
      expect(screen.getByText('支持图片和PDF文件')).toBeInTheDocument();
    });
  });

  it('shows file list after loading', async () => {
    render(<FileUpload interviewId="iv-1" />);
    await waitFor(() => {
      expect(screen.getByText('访谈记录.pdf')).toBeInTheDocument();
      expect(screen.getByText('照片.jpg')).toBeInTheDocument();
      expect(screen.getByText('扫描件.png')).toBeInTheDocument();
    });
  });

  it('renders OCR status tags', async () => {
    render(<FileUpload interviewId="iv-1" />);
    await waitFor(() => {
      expect(screen.getByText('已完成')).toBeInTheDocument();
      expect(screen.getByText('待处理')).toBeInTheDocument();
      expect(screen.getByText('失败')).toBeInTheDocument();
    });
  });

  it('clicks re-OCR button', async () => {
    const user = userEvent.setup();
    render(<FileUpload interviewId="iv-1" />);
    await waitFor(() => expect(screen.getByText('访谈记录.pdf')).toBeInTheDocument());

    const reOcrButtons = screen.getAllByText('重新OCR');
    await user.click(reOcrButtons[0]);
    await waitFor(() => {
      expect(request.post).toHaveBeenCalledWith('/interviews/iv-1/files/f1/ocr');
      expect(message.success).toHaveBeenCalledWith('已触发重新OCR');
    });
  });

  it('clicks delete button and confirms', async () => {
    const user = userEvent.setup();
    render(<FileUpload interviewId="iv-1" />);
    await waitFor(() => expect(screen.getByText('访谈记录.pdf')).toBeInTheDocument());

    const deleteButtons = screen.getAllByText('删除');
    await user.click(deleteButtons[0]);
    await waitFor(() => {
      expect(screen.getByText('确定删除此文件？')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: '删 除' }));
    await waitFor(() => {
      expect(request.delete).toHaveBeenCalledWith('/interviews/iv-1/files/f1');
      expect(message.success).toHaveBeenCalledWith('删除成功');
    });
  });

  it('shows error when loading files fails', async () => {
    (request.get as any).mockRejectedValueOnce(new Error('fail'));
    render(<FileUpload interviewId="iv-1" />);
    await waitFor(() => {
      expect(message.error).toHaveBeenCalledWith('加载文件列表失败');
    });
  });

  it('shows error on re-OCR failure', async () => {
    (request.post as any).mockRejectedValueOnce(new Error('fail'));
    const user = userEvent.setup();
    render(<FileUpload interviewId="iv-1" />);
    await waitFor(() => expect(screen.getByText('访谈记录.pdf')).toBeInTheDocument());

    const reOcrButtons = screen.getAllByText('重新OCR');
    await user.click(reOcrButtons[0]);
    await waitFor(() => {
      expect(message.error).toHaveBeenCalledWith('重新OCR失败');
    });
  });

  it('shows error on delete failure', async () => {
    (request.delete as any).mockRejectedValueOnce(new Error('fail'));
    const user = userEvent.setup();
    render(<FileUpload interviewId="iv-1" />);
    await waitFor(() => expect(screen.getByText('访谈记录.pdf')).toBeInTheDocument());

    const deleteButtons = screen.getAllByText('删除');
    await user.click(deleteButtons[0]);
    await waitFor(() => expect(screen.getByText('确定删除此文件？')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: '删 除' }));
    await waitFor(() => {
      expect(message.error).toHaveBeenCalledWith('删除失败');
    });
  });

  it('handleUpload success via file input change', async () => {
    render(<FileUpload interviewId="iv-1" />);
    await waitFor(() => expect(screen.getByText('点击或拖拽文件到此区域上传')).toBeInTheDocument());

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();

    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(request.post).toHaveBeenCalledWith(
        '/interviews/iv-1/files',
        expect.any(FormData),
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      expect(message.success).toHaveBeenCalledWith('上传成功');
    });
  });

  it('handleUpload error shows error message', async () => {
    (request.post as any).mockRejectedValueOnce(new Error('upload fail'));
    render(<FileUpload interviewId="iv-1" />);
    await waitFor(() => expect(screen.getByText('点击或拖拽文件到此区域上传')).toBeInTheDocument());

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(message.error).toHaveBeenCalledWith('上传失败');
    });
  });
});
