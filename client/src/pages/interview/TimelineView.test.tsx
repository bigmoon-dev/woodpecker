import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import TimelineView from './TimelineView';

vi.mock('../../utils/request', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockUseParams = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => mockUseParams(),
  };
});

import request from '../../utils/request';

const mockEvents = [
  { id: 'e1', date: '2024-01-15T10:00:00.000Z', eventType: 'interview', summary: '初始访谈' },
  { id: 'e2', date: '2024-01-20T14:00:00.000Z', eventType: 'assessment', summary: '心理评估' },
  { id: 'e3', date: '2024-01-25T09:00:00.000Z', eventType: 'alert', summary: '预警通知' },
];

describe('TimelineView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({ studentId: 'test-student-id' });
  });

  it('renders timeline with events', async () => {
    (request.get as any).mockResolvedValue({ data: mockEvents });
    render(<TimelineView />);

    await waitFor(() => {
      expect(screen.getByText('学生时间线')).toBeInTheDocument();
      expect(screen.getByText('初始访谈')).toBeInTheDocument();
      expect(screen.getByText('心理评估')).toBeInTheDocument();
      expect(screen.getByText('预警通知')).toBeInTheDocument();
    });
  });

  it('renders different event type tags', async () => {
    (request.get as any).mockResolvedValue({ data: mockEvents });
    render(<TimelineView />);

    await waitFor(() => {
      expect(screen.getByText('访谈')).toBeInTheDocument();
      expect(screen.getByText('评估')).toBeInTheDocument();
      expect(screen.getByText('预警')).toBeInTheDocument();
    });
  });

  it('shows empty state when no events', async () => {
    (request.get as any).mockResolvedValue({ data: [] });
    render(<TimelineView />);

    await waitFor(() => {
      expect(screen.getByText('暂无时间线事件')).toBeInTheDocument();
    });
  });

  it('shows loading when no studentId and not yet resolved', () => {
    mockUseParams.mockReturnValue({});
    const { container } = render(<TimelineView />);
    expect(container.querySelector('.ant-spin')).toBeInTheDocument();
  });

  it('uses prop studentId over param studentId', async () => {
    (request.get as any).mockResolvedValue({ data: mockEvents });
    render(<TimelineView studentId="prop-student-id" />);

    await waitFor(() => {
      expect(request.get).toHaveBeenCalledWith('/interviews/timeline/prop-student-id');
    });
  });

  it('shows empty state on API failure', async () => {
    (request.get as any).mockRejectedValue(new Error('fail'));
    render(<TimelineView />);

    await waitFor(() => {
      expect(screen.getByText('暂无时间线事件')).toBeInTheDocument();
    });
  });

  it('shows loading spinner initially', () => {
    (request.get as any).mockReturnValue(new Promise(() => {}));
    const { container } = render(<TimelineView />);
    expect(container.querySelector('.ant-spin')).toBeInTheDocument();
  });

  it('renders event dates', async () => {
    (request.get as any).mockResolvedValue({ data: mockEvents });
    render(<TimelineView />);

    await waitFor(() => {
      expect(screen.getByText('初始访谈')).toBeInTheDocument();
    });

    const dateTexts = screen.getAllByText(/2024/);
    expect(dateTexts.length).toBeGreaterThan(0);
  });
});
