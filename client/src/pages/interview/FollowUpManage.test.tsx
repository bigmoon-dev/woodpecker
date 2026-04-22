import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FollowUpManage from './FollowUpManage';

let capturedForm: any;

vi.mock('antd', async () => {
  const actual = (await vi.importActual('antd')) as Record<string, any>;
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
    Form: {
      ...actual.Form,
      useForm: () => {
        const [form] = actual.Form.useForm();
        capturedForm = form;
        return [form];
      },
    },
  };
});

vi.mock('../../utils/request', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import request from '../../utils/request';
import { message } from 'antd';

const mockFollowUps = [
  { id: 'fu1', studentName: '张三', reminderDate: '2024-02-01', notes: '需要回访', completed: false },
  { id: 'fu2', studentName: '李四', reminderDate: '2024-02-05', notes: '已处理完毕', completed: true },
];

const mockInterviews = [
  { id: 'iv1', studentName: '张三', interviewDate: '2024-01-15T10:00:00.000Z' },
  { id: 'iv2', studentName: '李四', interviewDate: '2024-01-16T14:00:00.000Z' },
];

describe('FollowUpManage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedForm = undefined;
    (request.get as any).mockImplementation((url: string) => {
      if (url.includes('/follow-ups/')) {
        return Promise.resolve({ data: mockFollowUps, total: 2 });
      }
      return Promise.resolve({ data: mockInterviews });
    });
    (request.post as any).mockResolvedValue({});
    (request.put as any).mockResolvedValue({});
  });

  it('renders follow-up list', async () => {
    render(<FollowUpManage />);
    await waitFor(() => {
      expect(screen.getByText('张三')).toBeInTheDocument();
      expect(screen.getByText('李四')).toBeInTheDocument();
    });
  });

  it('renders status tags for pending and completed', async () => {
    render(<FollowUpManage />);
    await waitFor(() => {
      expect(screen.getByText('待处理')).toBeInTheDocument();
      expect(screen.getByText('已完成')).toBeInTheDocument();
    });
  });

  it('switches between pending and completed tabs', async () => {
    const user = userEvent.setup();
    render(<FollowUpManage />);
    await waitFor(() => expect(screen.getByText('张三')).toBeInTheDocument());

    await user.click(screen.getByRole('tab', { name: '已完成' }));
    await waitFor(() => {
      expect(request.get).toHaveBeenCalledWith(
        '/interviews/follow-ups/pending',
        expect.objectContaining({ params: expect.objectContaining({ completed: true }) }),
      );
    });
  });

  it('opens create modal', async () => {
    const user = userEvent.setup();
    render(<FollowUpManage />);
    await waitFor(() => expect(screen.getByText('张三')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /新建随访/ }));
    await waitFor(() => {
      expect(screen.getByText('关联访谈')).toBeInTheDocument();
    });
  });

  it('clicks "标记完成" button', async () => {
    const user = userEvent.setup();
    render(<FollowUpManage />);
    await waitFor(() => expect(screen.getByText('张三')).toBeInTheDocument());

    const completeButtons = screen.getAllByRole('button', { name: /标记完成/ });
    expect(completeButtons.length).toBeGreaterThan(0);
    await user.click(completeButtons[0]);

    await waitFor(() => {
      expect(request.put).toHaveBeenCalledWith('/interviews/follow-ups/fu1/complete');
      expect(message.success).toHaveBeenCalledWith('已标记完成');
    });
  });

  it('does not show "标记完成" for completed items', async () => {
    render(<FollowUpManage />);
    await waitFor(() => expect(screen.getByText('张三')).toBeInTheDocument());
    const completeButtons = screen.getAllByRole('button', { name: /标记完成/ });
    expect(completeButtons.length).toBe(1);
  });

  it('shows error on complete failure', async () => {
    (request.put as any).mockRejectedValueOnce(new Error('fail'));
    const user = userEvent.setup();
    render(<FollowUpManage />);
    await waitFor(() => expect(screen.getByText('张三')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /标记完成/ }));
    await waitFor(() => {
      expect(message.error).toHaveBeenCalledWith('操作失败');
    });
  });

  it('handleCreate success via form.submit()', async () => {
    const user = userEvent.setup();
    render(<FollowUpManage />);
    await waitFor(() => expect(screen.getByText('张三')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /新建随访/ }));
    await waitFor(() => expect(document.querySelector('.ant-modal')).toBeTruthy());

    expect(capturedForm).toBeTruthy();
    capturedForm.setFieldsValue({
      interviewId: 'iv1',
      studentId: 's1',
      reminderDate: { format: () => '2024-02-01' },
      notes: '测试备注',
    });
    capturedForm.submit();

    await waitFor(() => {
      expect(request.post).toHaveBeenCalledWith('/interviews/iv1/follow-up', expect.objectContaining({
        studentId: 's1',
        notes: '测试备注',
      }));
      expect(message.success).toHaveBeenCalledWith('创建成功');
    });
  });

  it('handleCreate error shows error message', async () => {
    (request.post as any).mockRejectedValueOnce(new Error('fail'));
    const user = userEvent.setup();
    render(<FollowUpManage />);
    await waitFor(() => expect(screen.getByText('张三')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /新建随访/ }));
    await waitFor(() => expect(document.querySelector('.ant-modal')).toBeTruthy());

    capturedForm.setFieldsValue({
      interviewId: 'iv1',
      studentId: 's1',
      reminderDate: { format: () => '2024-02-01' },
      notes: '测试备注',
    });
    capturedForm.submit();

    await waitFor(() => {
      expect(message.error).toHaveBeenCalledWith('创建失败');
    });
  });

  it('closes modal on cancel', async () => {
    const user = userEvent.setup();
    render(<FollowUpManage />);
    await waitFor(() => expect(screen.getByText('张三')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /新建随访/ }));
    await waitFor(() => expect(document.querySelector('.ant-modal')).toBeTruthy());

    const cancelBtn = screen.getAllByRole('button').find(
      (btn) => /取\s*消|Cancel/i.test(btn.textContent || ''),
    );
    expect(cancelBtn).toBeTruthy();
    await user.click(cancelBtn!);
  });
});
