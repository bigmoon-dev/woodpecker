import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InterviewList from './InterviewList';

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

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/teacher/interviews' }),
  };
});

import request from '../../utils/request';
import { message } from 'antd';

const mockInterviews = [
  {
    id: '1',
    studentName: '张三',
    interviewDate: '2024-01-15T10:00:00.000Z',
    riskLevel: 'normal',
    status: 'draft',
  },
  {
    id: '2',
    studentName: '李四',
    interviewDate: '2024-01-16T14:00:00.000Z',
    riskLevel: 'crisis',
    status: 'completed',
  },
];

function getDeleteButtons() {
  return screen.getAllByRole('button').filter(
    (btn) => /删\s*除/.test(btn.textContent || ''),
  );
}

function getConfirmDeleteButton() {
  const allBtns = screen.getAllByRole('button').filter(
    (btn) => /删\s*除/.test(btn.textContent || '') && btn.classList.contains('ant-btn-primary'),
  );
  return allBtns[0];
}

describe('InterviewList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedForm = undefined;
    (request.get as any).mockImplementation((url: string) => {
      if (url.includes('/templates/all')) return Promise.resolve([]);
      return Promise.resolve({ data: mockInterviews, total: 2 });
    });
    (request.post as any).mockResolvedValue({});
    (request.delete as any).mockResolvedValue({});
  });

  it('renders table with interview data', async () => {
    render(<InterviewList />);
    await waitFor(() => {
      expect(screen.getByText('张三')).toBeInTheDocument();
      expect(screen.getByText('李四')).toBeInTheDocument();
    });
  });

  it('renders status and riskLevel tags', async () => {
    render(<InterviewList />);
    await waitFor(() => {
      expect(screen.getByText('草稿')).toBeInTheDocument();
      expect(screen.getByText('已完成')).toBeInTheDocument();
      expect(screen.getByText('一般')).toBeInTheDocument();
      expect(screen.getByText('危机')).toBeInTheDocument();
    });
  });

  it('opens create modal when clicking "新建访谈"', async () => {
    const user = userEvent.setup();
    render(<InterviewList />);
    await waitFor(() => expect(screen.getByText('张三')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /新建访谈/ }));
    await waitFor(() => {
      expect(screen.getByText('选择学生')).toBeInTheDocument();
    });
  });

  it('clicks OK in create modal triggers form validation', async () => {
    const user = userEvent.setup();
    render(<InterviewList />);
    await waitFor(() => expect(screen.getByText('张三')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /新建访谈/ }));
    await waitFor(() => {
      expect(screen.getByText('选择学生')).toBeInTheDocument();
    });

    const okBtn = screen.getAllByRole('button').find(
      (btn) => /确\s*定|OK/i.test(btn.textContent || '') && btn.classList.contains('ant-btn-primary'),
    );
    await user.click(okBtn!);
    await waitFor(() => {
      expect(screen.getByText('请选择学生')).toBeInTheDocument();
    });
  });

  it('deletes interview after confirmation', async () => {
    const user = userEvent.setup();
    render(<InterviewList />);
    await waitFor(() => expect(screen.getByText('张三')).toBeInTheDocument());

    const deleteButtons = getDeleteButtons();
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('确定删除此访谈？')).toBeInTheDocument();
    });

    await user.click(getConfirmDeleteButton());
    await waitFor(() => {
      expect(request.delete).toHaveBeenCalledWith('/interviews/1');
      expect(message.success).toHaveBeenCalledWith('删除成功');
    });
  });

  it('navigates to detail on "查看" click', async () => {
    const user = userEvent.setup();
    render(<InterviewList />);
    await waitFor(() => expect(screen.getByText('张三')).toBeInTheDocument());

    const viewButtons = screen.getAllByRole('button').filter(
      (btn) => /查看/.test(btn.textContent || ''),
    );
    expect(viewButtons.length).toBeGreaterThan(0);
    await user.click(viewButtons[0]);
  });

  it('shows error message on delete failure', async () => {
    (request.delete as any).mockRejectedValueOnce(new Error('fail'));
    const user = userEvent.setup();
    render(<InterviewList />);
    await waitFor(() => expect(screen.getByText('张三')).toBeInTheDocument());

    const deleteButtons = getDeleteButtons();
    await user.click(deleteButtons[0]);
    await waitFor(() => expect(screen.getByText('确定删除此访谈？')).toBeInTheDocument());

    await user.click(getConfirmDeleteButton());
    await waitFor(() => {
      expect(message.error).toHaveBeenCalledWith('删除失败');
    });
  });

  it('create modal contains template options', async () => {
    (request.get as any).mockImplementation((url: string) => {
      if (url.includes('/templates/all'))
        return Promise.resolve([{ id: 't1', name: '访谈模板A' }]);
      return Promise.resolve({ data: mockInterviews, total: 2 });
    });
    const user = userEvent.setup();
    render(<InterviewList />);
    await waitFor(() => expect(screen.getByText('张三')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /新建访谈/ }));
    await waitFor(() => {
      expect(document.querySelector('.ant-modal')).toBeTruthy();
    });
  });

  it('handleCreate success via form.submit()', async () => {
    const user = userEvent.setup();
    render(<InterviewList />);
    await waitFor(() => expect(screen.getByText('张三')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /新建访谈/ }));
    await waitFor(() => expect(document.querySelector('.ant-modal')).toBeTruthy());

    expect(capturedForm).toBeTruthy();
    capturedForm.setFieldsValue({
      studentId: 's1',
      psychologistId: 'p1',
      interviewDate: { format: () => '2024-01-15 10:00:00' },
      riskLevel: 'normal',
    });
    capturedForm.submit();

    await waitFor(() => {
      expect(request.post).toHaveBeenCalledWith('/interviews', expect.objectContaining({
        studentId: 's1',
        psychologistId: 'p1',
        riskLevel: 'normal',
      }));
      expect(message.success).toHaveBeenCalledWith('创建成功');
    });
  });

  it('handleCreate error shows message.error', async () => {
    (request.post as any).mockRejectedValueOnce(new Error('fail'));
    const user = userEvent.setup();
    render(<InterviewList />);
    await waitFor(() => expect(screen.getByText('张三')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /新建访谈/ }));
    await waitFor(() => expect(document.querySelector('.ant-modal')).toBeTruthy());

    capturedForm.setFieldsValue({
      studentId: 's1',
      psychologistId: 'p1',
      interviewDate: { format: () => '2024-01-15 10:00:00' },
      riskLevel: 'normal',
    });
    capturedForm.submit();

    await waitFor(() => {
      expect(message.error).toHaveBeenCalledWith('创建失败');
    });
  });

  it('closes modal on cancel', async () => {
    const user = userEvent.setup();
    render(<InterviewList />);
    await waitFor(() => expect(screen.getByText('张三')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /新建访谈/ }));
    await waitFor(() => expect(document.querySelector('.ant-modal')).toBeTruthy());

    const cancelBtn = screen.getAllByRole('button').find(
      (btn) => /取\s*消|Cancel/i.test(btn.textContent || ''),
    );
    expect(cancelBtn).toBeTruthy();
    await user.click(cancelBtn!);
  });
});
