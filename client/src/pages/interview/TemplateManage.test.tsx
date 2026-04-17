import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TemplateManage from './TemplateManage';

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

const mockTemplates = [
  { id: 't1', name: '标准访谈模板', description: '用于常规心理访谈', createdAt: '2024-01-01T00:00:00.000Z', fields: [] },
  { id: 't2', name: '危机评估模板', description: '用于危机情况评估', createdAt: '2024-01-02T00:00:00.000Z', fields: [{ key: 'risk', label: '风险' }] },
];

function findPrimaryButton(namePattern: RegExp) {
  return screen.getAllByRole('button').find(
    (btn) => namePattern.test(btn.textContent || '') && btn.classList.contains('ant-btn-primary'),
  )!;
}

function findLinkButton(namePattern: RegExp, index = 0) {
  return screen.getAllByRole('button').filter(
    (btn) => namePattern.test(btn.textContent || '') && btn.classList.contains('ant-btn-link'),
  )[index]!;
}

describe('TemplateManage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (request.get as any).mockResolvedValue({ data: mockTemplates, total: 2 });
    (request.post as any).mockResolvedValue({});
    (request.put as any).mockResolvedValue({});
    (request.delete as any).mockResolvedValue({});
  });

  it('renders template list', async () => {
    render(<TemplateManage />);
    await waitFor(() => {
      expect(screen.getByText('标准访谈模板')).toBeInTheDocument();
      expect(screen.getByText('危机评估模板')).toBeInTheDocument();
    });
  });

  it('opens create modal and creates template', async () => {
    const user = userEvent.setup();
    render(<TemplateManage />);
    await waitFor(() => expect(screen.getByText('标准访谈模板')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /新建模板/ }));
    await waitFor(() => {
      expect(screen.getByLabelText('模板名称')).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText('模板名称');
    await user.type(nameInput, '新模板');

    await user.click(findPrimaryButton(/确\s*定|OK/i));

    await waitFor(() => {
      expect(request.post).toHaveBeenCalledWith(
        '/interviews/templates',
        expect.objectContaining({ name: '新模板', fields: [] }),
      );
      expect(message.success).toHaveBeenCalledWith('创建成功');
    });
  });

  it('creates template with JSON fields', async () => {
    const user = userEvent.setup();
    render(<TemplateManage />);
    await waitFor(() => expect(screen.getByText('标准访谈模板')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /新建模板/ }));
    await waitFor(() => expect(screen.getByLabelText('模板名称')).toBeInTheDocument());

    const nameInput = screen.getByLabelText('模板名称');
    await user.type(nameInput, '带字段模板');

    const fieldsTextareas = screen.getAllByRole('textbox');
    const fieldsTextarea = fieldsTextareas.find((el) => el.getAttribute('placeholder')?.includes('summary'));
    if (fieldsTextarea) {
      fireEvent.change(fieldsTextarea, { target: { value: '[{"key":"summary","label":"总结"}]' } });
    }

    await user.click(findPrimaryButton(/确\s*定|OK/i));

    await waitFor(() => {
      expect(request.post).toHaveBeenCalledWith(
        '/interviews/templates',
        expect.objectContaining({ name: '带字段模板', fields: [{ key: 'summary', label: '总结' }] }),
      );
    });
  });

  it('opens edit modal and edits template', async () => {
    const user = userEvent.setup();
    render(<TemplateManage />);
    await screen.findByText('标准访谈模板');

    await user.click(findLinkButton(/编\s*辑/, 0));
    await waitFor(() => {
      expect(screen.getByText('编辑模板')).toBeInTheDocument();
    });

    await user.click(findPrimaryButton(/确\s*定|OK/i));

    await waitFor(() => {
      expect(request.put).toHaveBeenCalledWith(
        '/interviews/templates/t1',
        expect.objectContaining({ name: '标准访谈模板' }),
      );
      expect(message.success).toHaveBeenCalledWith('更新成功');
    });
  });

  it('deletes template after confirmation', async () => {
    const user = userEvent.setup();
    render(<TemplateManage />);
    await screen.findByText('标准访谈模板');

    await user.click(findLinkButton(/删\s*除/, 0));
    await waitFor(() => expect(screen.getByText('确定删除此模板？')).toBeInTheDocument());

    await user.click(findPrimaryButton(/删\s*除/));
    await waitFor(() => {
      expect(request.delete).toHaveBeenCalledWith('/interviews/templates/t1');
      expect(message.success).toHaveBeenCalledWith('删除成功');
    });
  });

  it('shows error on create failure', async () => {
    (request.post as any).mockRejectedValueOnce(new Error('fail'));
    const user = userEvent.setup();
    render(<TemplateManage />);
    await screen.findByText('标准访谈模板');

    await user.click(screen.getByRole('button', { name: /新建模板/ }));
    await waitFor(() => expect(screen.getByLabelText('模板名称')).toBeInTheDocument());

    const nameInput = screen.getByLabelText('模板名称');
    await user.type(nameInput, '失败模板');

    await user.click(findPrimaryButton(/确\s*定|OK/i));

    await waitFor(() => {
      expect(message.error).toHaveBeenCalledWith('创建失败');
    });
  });

  it('shows error on edit failure', async () => {
    (request.put as any).mockRejectedValueOnce(new Error('fail'));
    const user = userEvent.setup();
    render(<TemplateManage />);
    await screen.findByText('标准访谈模板');

    await user.click(findLinkButton(/编\s*辑/, 0));
    await waitFor(() => expect(screen.getByText('编辑模板')).toBeInTheDocument());

    await user.click(findPrimaryButton(/确\s*定|OK/i));

    await waitFor(() => {
      expect(message.error).toHaveBeenCalledWith('更新失败');
    });
  });

  it('shows error on delete failure', async () => {
    (request.delete as any).mockRejectedValueOnce(new Error('fail'));
    const user = userEvent.setup();
    render(<TemplateManage />);
    await screen.findByText('标准访谈模板');

    await user.click(findLinkButton(/删\s*除/, 0));
    await waitFor(() => expect(screen.getByText('确定删除此模板？')).toBeInTheDocument());

    await user.click(findPrimaryButton(/删\s*除/));
    await waitFor(() => {
      expect(message.error).toHaveBeenCalledWith('删除失败');
    });
  });

  it('validates JSON fields - rejects invalid JSON in create modal', async () => {
    const user = userEvent.setup();
    render(<TemplateManage />);
    await screen.findByText('标准访谈模板');

    await user.click(screen.getByRole('button', { name: /新建模板/ }));
    await waitFor(() => expect(screen.getByLabelText('模板名称')).toBeInTheDocument());

    const nameInput = screen.getByLabelText('模板名称');
    await user.type(nameInput, '测试模板');

    const fieldsTextareas = screen.getAllByRole('textbox');
    const fieldsTextarea = fieldsTextareas.find((el) => el.getAttribute('placeholder')?.includes('summary'));
    if (fieldsTextarea) {
      fireEvent.change(fieldsTextarea, { target: { value: 'not valid json{{{' } });
    }

    await user.click(findPrimaryButton(/确\s*定|OK/i));

    await waitFor(() => {
      expect(screen.getByText('请输入合法的JSON')).toBeInTheDocument();
    });
  });

  it('validates JSON fields - rejects invalid JSON in edit modal', async () => {
    const user = userEvent.setup();
    render(<TemplateManage />);
    await screen.findByText('标准访谈模板');

    await user.click(findLinkButton(/编\s*辑/, 0));
    await waitFor(() => expect(screen.getByText('编辑模板')).toBeInTheDocument());

    const allTextareas = screen.getAllByRole('textbox');
    const fieldsTextarea = allTextareas.length >= 2 ? allTextareas[allTextareas.length - 1] : allTextareas[0];
    fireEvent.change(fieldsTextarea, { target: { value: 'invalid json!!!' } });

    await user.click(findPrimaryButton(/确\s*定|OK/i));

    await waitFor(() => {
      expect(screen.getByText('请输入合法的JSON')).toBeInTheDocument();
    });
  });

  it('closes create modal on cancel', async () => {
    const user = userEvent.setup();
    render(<TemplateManage />);
    await screen.findByText('标准访谈模板');

    await user.click(screen.getByRole('button', { name: /新建模板/ }));
    await waitFor(() => expect(screen.getAllByText('新建模板').length).toBeGreaterThan(0));

    const cancelBtn = screen.getAllByRole('button').find(
      (btn) => /取\s*消|Cancel/i.test(btn.textContent || ''),
    );
    expect(cancelBtn).toBeTruthy();
    await user.click(cancelBtn!);
  });

  it('closes edit modal on cancel', async () => {
    const user = userEvent.setup();
    render(<TemplateManage />);
    await screen.findByText('标准访谈模板');

    await user.click(findLinkButton(/编\s*辑/, 0));
    await waitFor(() => expect(screen.getByText('编辑模板')).toBeInTheDocument());

    const cancelBtn = screen.getAllByRole('button').find(
      (btn) => /取\s*消|Cancel/i.test(btn.textContent || ''),
    );
    expect(cancelBtn).toBeTruthy();
    await user.click(cancelBtn!);
  });
});
