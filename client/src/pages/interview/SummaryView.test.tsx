import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SummaryView from './SummaryView';

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

describe('SummaryView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (request.post as any).mockResolvedValue({});
  });

  it('shows "提取摘要" button when no summary and no OCR text', async () => {
    render(<SummaryView interviewId="iv-1" ocrText={null} structuredSummary={null} />);
    expect(screen.getByText('提取摘要')).toBeInTheDocument();
    expect(screen.getByText('暂无摘要数据')).toBeInTheDocument();
  });

  it('shows summary content when structuredSummary is available', () => {
    const summary = { 总结: '学生心理状态良好', 建议: '继续关注' };
    render(<SummaryView interviewId="iv-1" ocrText={null} structuredSummary={summary} />);
    expect(screen.getByText('学生心理状态良好')).toBeInTheDocument();
    expect(screen.getByText('继续关注')).toBeInTheDocument();
  });

  it('shows OCR text panel when ocrText is available', () => {
    render(<SummaryView interviewId="iv-1" ocrText="OCR识别的内容" structuredSummary={null} />);
    expect(screen.getByText('提取摘要')).toBeInTheDocument();
    expect(screen.getByText('原始OCR文本')).toBeInTheDocument();
  });

  it('shows OCR text content in collapse panel', async () => {
    const user = userEvent.setup();
    render(<SummaryView interviewId="iv-1" ocrText="这是OCR文本" structuredSummary={null} />);

    await user.click(screen.getByText('原始OCR文本'));
    await waitFor(() => {
      expect(screen.getByText('这是OCR文本')).toBeInTheDocument();
    });
  });

  it('calls extract summary API and shows success', async () => {
    const onReload = vi.fn();
    const user = userEvent.setup();
    render(<SummaryView interviewId="iv-1" ocrText={null} structuredSummary={null} onReload={onReload} />);

    await user.click(screen.getByText('提取摘要'));
    await waitFor(() => {
      expect(request.post).toHaveBeenCalledWith('/interviews/iv-1/extract-summary');
      expect(message.success).toHaveBeenCalledWith('摘要提取成功');
      expect(onReload).toHaveBeenCalled();
    });
  });

  it('shows error on extract failure', async () => {
    (request.post as any).mockRejectedValueOnce(new Error('fail'));
    const user = userEvent.setup();
    render(<SummaryView interviewId="iv-1" ocrText={null} structuredSummary={null} />);

    await user.click(screen.getByText('提取摘要'));
    await waitFor(() => {
      expect(message.error).toHaveBeenCalledWith('摘要提取失败');
    });
  });

  it('renders summary with both summary and OCR text', () => {
    const summary = { 总结: '良好' };
    render(<SummaryView interviewId="iv-1" ocrText="OCR内容" structuredSummary={summary} />);
    expect(screen.getByText('良好')).toBeInTheDocument();
    expect(screen.getByText('原始OCR文本')).toBeInTheDocument();
    expect(screen.queryByText('提取摘要')).not.toBeInTheDocument();
  });
});
