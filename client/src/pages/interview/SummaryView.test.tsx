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
    (request.put as any).mockResolvedValue({});
  });

  it('shows empty state when no ocrText and no summary', () => {
    render(
      <SummaryView interviewId="iv-1" ocrText={null} structuredSummary={null} />,
    );
    expect(screen.getByText('暂无摘要数据，请先上传文件并等待OCR完成')).toBeInTheDocument();
  });

  it('shows manual extract button in empty state', () => {
    render(
      <SummaryView interviewId="iv-1" ocrText={null} structuredSummary={null} />,
    );
    expect(screen.getByRole('button', { name: /手动提取摘要/ })).toBeInTheDocument();
  });

  it('shows info alert when ocrText exists but no summary', () => {
    render(
      <SummaryView interviewId="iv-1" ocrText="some ocr text" structuredSummary={null} />,
    );
    expect(screen.getByText('OCR已完成，摘要提取中...')).toBeInTheDocument();
  });

  it('renders editable form fields from structuredSummary', () => {
    render(
      <SummaryView
        interviewId="iv-1"
        ocrText="ocr text"
        structuredSummary={{ summary: '测试摘要', risk: '一般' }}
      />,
    );
    expect(screen.getByText('summary')).toBeInTheDocument();
    expect(screen.getByText('risk')).toBeInTheDocument();
  });

  it('renders editable form fields from templateFields', () => {
    render(
      <SummaryView
        interviewId="iv-1"
        ocrText="ocr text"
        structuredSummary={{ summary: '测试摘要' }}
        templateFields={[
          { key: 'summary', label: '总结' },
          { key: 'risk', label: '风险等级' },
        ]}
      />,
    );
    expect(screen.getByText('总结')).toBeInTheDocument();
    expect(screen.getByText('风险等级')).toBeInTheDocument();
  });

  it('saves edited summary on form submit', async () => {
    const onReload = vi.fn();
    render(
      <SummaryView
        interviewId="iv-1"
        ocrText="ocr text"
        structuredSummary={{ summary: '初始摘要' }}
        onReload={onReload}
      />,
    );

    const saveBtn = screen.getByRole('button', { name: /保存摘要/ });
    await userEvent.setup().click(saveBtn);

    await waitFor(() => {
      expect(request.put).toHaveBeenCalledWith('/interviews/iv-1', {
        structuredSummary: { summary: '初始摘要' },
      });
      expect(message.success).toHaveBeenCalledWith('保存成功');
    });
  });

  it('shows error on save failure', async () => {
    (request.put as any).mockRejectedValueOnce(new Error('fail'));
    render(
      <SummaryView
        interviewId="iv-1"
        ocrText="ocr text"
        structuredSummary={{ summary: '测试' }}
      />,
    );

    const saveBtn = screen.getByRole('button', { name: /保存摘要/ });
    await userEvent.setup().click(saveBtn);

    await waitFor(() => {
      expect(message.error).toHaveBeenCalledWith('保存失败');
    });
  });

  it('calls extract-summary on manual extract button', async () => {
    const onReload = vi.fn();
    render(
      <SummaryView interviewId="iv-1" ocrText={null} structuredSummary={null} onReload={onReload} />,
    );

    const extractBtn = screen.getByRole('button', { name: /手动提取摘要/ });
    await userEvent.setup().click(extractBtn);

    await waitFor(() => {
      expect(request.post).toHaveBeenCalledWith('/interviews/iv-1/extract-summary');
      expect(message.success).toHaveBeenCalledWith('摘要提取成功');
      expect(onReload).toHaveBeenCalled();
    });
  });

  it('shows error on extract failure', async () => {
    (request.post as any).mockRejectedValueOnce(new Error('fail'));
    render(
      <SummaryView interviewId="iv-1" ocrText={null} structuredSummary={null} />,
    );

    const extractBtn = screen.getByRole('button', { name: /手动提取摘要/ });
    await userEvent.setup().click(extractBtn);

    await waitFor(() => {
      expect(message.error).toHaveBeenCalledWith('摘要提取失败');
    });
  });

  it('shows re-extract button when summary exists', () => {
    render(
      <SummaryView
        interviewId="iv-1"
        ocrText="ocr text"
        structuredSummary={{ summary: '测试' }}
      />,
    );
    expect(screen.getByRole('button', { name: /重新提取/ })).toBeInTheDocument();
  });

  it('shows ocr text in collapse panel', () => {
    render(
      <SummaryView
        interviewId="iv-1"
        ocrText="这是一段OCR识别的文本内容"
        structuredSummary={{ summary: '测试' }}
      />,
    );
    expect(screen.getByText('原始OCR文本')).toBeInTheDocument();
  });
});
