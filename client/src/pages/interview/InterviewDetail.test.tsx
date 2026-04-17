import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InterviewDetail from './InterviewDetail';

vi.mock('../../utils/request', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: 'test-interview-id' }),
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/teacher/interviews/test-interview-id' }),
  };
});

vi.mock('antd', async () => {
  const actual = await vi.importActual('antd');
  return { ...actual, message: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } };
});

vi.mock('./FileUpload', () => ({
  default: () => <div data-testid="file-upload">FileUpload</div>,
}));

vi.mock('./SummaryView', () => ({
  default: () => <div data-testid="summary-view">SummaryView</div>,
}));

vi.mock('./OcrEditor', () => ({
  default: () => <div data-testid="ocr-editor">OcrEditor</div>,
}));

import request from '../../utils/request';
import { message } from 'antd';

const mockData = {
  id: 'test-interview-id',
  studentName: '张三',
  psychologistName: '王老师',
  interviewDate: '2024-01-15T10:00:00.000Z',
  location: '心理咨询室',
  riskLevel: 'attention',
  status: 'draft',
  notes: '定期访谈',
  ocrText: 'some ocr text',
  structuredSummary: null,
};

describe('InterviewDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (request.get as any).mockImplementation((url: string) => {
      if (url.includes('/templates/')) return Promise.resolve({ fields: [] });
      return Promise.resolve(mockData);
    });
    (request.put as any).mockResolvedValue({});
  });

  it('loads and renders interview data in info tab', async () => {
    render(<InterviewDetail />);
    await waitFor(() => {
      expect(screen.getByText('访谈详情')).toBeInTheDocument();
      expect(screen.getByText('张三')).toBeInTheDocument();
      expect(screen.getByText('王老师')).toBeInTheDocument();
      expect(screen.getByText('心理咨询室')).toBeInTheDocument();
    });
  });

  it('renders status and risk level tags', async () => {
    render(<InterviewDetail />);
    await waitFor(() => {
      expect(screen.getByText('草稿')).toBeInTheDocument();
      expect(screen.getByText('关注')).toBeInTheDocument();
    });
  });

  it('switches between tabs', async () => {
    const user = userEvent.setup();
    render(<InterviewDetail />);
    await waitFor(() => expect(screen.getByText('访谈详情')).toBeInTheDocument());

    await user.click(screen.getByRole('tab', { name: '文件管理' }));
    await waitFor(() => {
      expect(screen.getByTestId('file-upload')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('tab', { name: 'OCR文本' }));
    await waitFor(() => {
      expect(screen.getByTestId('ocr-editor')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('tab', { name: '结构化摘要' }));
    await waitFor(() => {
      expect(screen.getByTestId('summary-view')).toBeInTheDocument();
    });
  });

  it('opens edit modal and submits', async () => {
    const user = userEvent.setup();
    render(<InterviewDetail />);
    await waitFor(() => expect(screen.getByRole('button', { name: /编\s*辑/ })).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /编\s*辑/ }));
    await waitFor(() => {
      expect(screen.getByText('编辑访谈')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'OK' }));
  });

  it('clicks status transition button for draft -> reviewed', async () => {
    const user = userEvent.setup();
    render(<InterviewDetail />);
    await waitFor(() => expect(screen.getByRole('button', { name: /标记为已审阅/ })).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /标记为已审阅/ }));
    await waitFor(() => {
      expect(request.put).toHaveBeenCalledWith(
        '/interviews/test-interview-id',
        expect.objectContaining({ status: 'reviewed' }),
      );
      expect(message.success).toHaveBeenCalledWith('状态更新成功');
    });
  });

  it('shows completed transition button for reviewed status', async () => {
    (request.get as any).mockResolvedValue({ ...mockData, status: 'reviewed' });
    const user = userEvent.setup();
    render(<InterviewDetail />);
    await waitFor(() => expect(screen.getByRole('button', { name: /标记为已完成/ })).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /标记为已完成/ }));
    await waitFor(() => {
      expect(request.put).toHaveBeenCalledWith(
        '/interviews/test-interview-id',
        expect.objectContaining({ status: 'completed' }),
      );
    });
  });

  it('shows "未找到访谈记录" when data is null', async () => {
    (request.get as any).mockResolvedValue(null);
    render(<InterviewDetail />);
    await waitFor(() => {
      expect(screen.getByText('未找到访谈记录')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('fetches template fields when templateId exists', async () => {
    (request.get as any).mockImplementation((url: string) => {
      if (url.includes('/templates/')) return Promise.resolve({ fields: [{ key: 'summary', label: '总结' }] });
      return Promise.resolve({ ...mockData, templateId: 'tpl-1' });
    });
    render(<InterviewDetail />);
    await waitFor(() => {
      expect(screen.getByText('访谈详情')).toBeInTheDocument();
    });
    expect(request.get).toHaveBeenCalledWith('/interviews/templates/tpl-1');
  });

  it('handles template fetch failure gracefully', async () => {
    (request.get as any).mockImplementation((url: string) => {
      if (url.includes('/templates/')) return Promise.reject(new Error('fail'));
      return Promise.resolve({ ...mockData, templateId: 'tpl-1' });
    });
    render(<InterviewDetail />);
    await waitFor(() => {
      expect(screen.getByText('访谈详情')).toBeInTheDocument();
    });
  });

  it('shows error on status transition failure', async () => {
    (request.put as any).mockRejectedValueOnce(new Error('fail'));
    const user = userEvent.setup();
    render(<InterviewDetail />);
    await waitFor(() => expect(screen.getByRole('button', { name: /标记为已审阅/ })).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /标记为已审阅/ }));
    await waitFor(() => {
      expect(message.error).toHaveBeenCalledWith('状态更新失败');
    });
  });

  it('shows error on update failure', async () => {
    (request.put as any).mockRejectedValueOnce(new Error('fail'));
    const user = userEvent.setup();
    render(<InterviewDetail />);
    await waitFor(() => expect(screen.getByRole('button', { name: /编\s*辑/ })).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /编\s*辑/ }));
    await waitFor(() => expect(screen.getByText('编辑访谈')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'OK' }));
    await waitFor(() => {
      expect(message.error).toHaveBeenCalledWith('更新失败');
    });
  });

  it('clicks 返回 button', async () => {
    const user = userEvent.setup();
    render(<InterviewDetail />);
    await waitFor(() => expect(screen.getByRole('button', { name: /返\s*回/ })).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /返\s*回/ }));
  });
});
