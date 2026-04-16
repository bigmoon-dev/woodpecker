import { useRef, useState } from 'react';
import {
  ProTable,
  type ActionType,
  type ProColumns,
} from '@ant-design/pro-components';
import {
  Button,
  Modal,
  Form,
  Input,
  DatePicker,
  Select,
  Tag,
  message,
} from 'antd';
import { DownloadOutlined, SendOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import request from '../../utils/request';
import { hasRole } from '../../utils/auth';

const STATUS_MAP: Record<string, { color: string; text: string }> = {
  draft: { color: 'blue', text: '草稿' },
  published: { color: 'green', text: '已发布' },
  completed: { color: 'default', text: '已完成' },
};

export default function TaskList() {
  const actionRef = useRef<ActionType>();
  const [createOpen, setCreateOpen] = useState(false);
  const [scales, setScales] = useState<any[]>([]);
  const [targets, setTargets] = useState<any[]>([]);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  const openCreate = async () => {
    const [scalesRes, targetsRes]: any[] = await Promise.all([
      request.get('/scales', { params: { page: 1, pageSize: 100 } }),
      hasRole('teacher')
        ? request.get('/admin/classes', {
            params: { page: 1, pageSize: 100 },
          })
        : Promise.resolve({ data: [] }),
    ]);
    setScales(scalesRes.data || scalesRes || []);
    setTargets(targetsRes.data || targetsRes || []);
    setCreateOpen(true);
  };

  const handleCreate = async (values: any) => {
    try {
      await request.post('/tasks', {
        ...values,
        deadline: values.deadline?.toISOString(),
      });
      message.success('创建成功');
      setCreateOpen(false);
      form.resetFields();
      actionRef.current?.reload();
    } catch {
      message.error('创建失败');
    }
  };

  const handlePublish = async (id: string) => {
    try {
      await request.post(`/tasks/${id}/publish`);
      message.success('发布成功');
      actionRef.current?.reload();
    } catch (err: any) {
      message.error(err?.response?.data?.message || '发布失败');
    }
  };

  const handleComplete = async (id: string) => {
    try {
      await request.post(`/tasks/${id}/complete`);
      message.success('已完成');
      actionRef.current?.reload();
    } catch (err: any) {
      message.error(err?.response?.data?.message || '操作失败');
    }
  };

  const isTeacher = hasRole('teacher');

  const columns: ProColumns[] = [
    { title: '标题', dataIndex: 'title', key: 'title' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (_: any, record: any) => {
        const s = STATUS_MAP[record.status] || {
          color: 'default',
          text: record.status,
        };
        return <Tag color={s.color}>{s.text}</Tag>;
      },
    },
    {
      title: '截止时间',
      dataIndex: 'deadline',
      key: 'deadline',
      render: (_: any, record: any) =>
        record.deadline ? new Date(record.deadline).toLocaleString() : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 240,
      render: (_: any, record: any) => (
        <>
          <Button
            type="link"
            onClick={() => {
              const basePath = isTeacher ? '/teacher' : '/student';
              navigate(`${basePath}/assessment/${record.id}`);
            }}
          >
            {isTeacher ? '查看' : '作答'}
          </Button>
          {isTeacher && record.status === 'draft' && (
            <Button
              type="link"
              icon={<SendOutlined />}
              onClick={() => handlePublish(record.id)}
            >
              发布
            </Button>
          )}
          {isTeacher && record.status === 'published' && (
            <Button
              type="link"
              onClick={() => handleComplete(record.id)}
            >
              完成
            </Button>
          )}
          {isTeacher && (
            <Button
              type="link"
              icon={<DownloadOutlined />}
              href={`/api/export/excel/task/${record.id}`}
              target="_blank"
            >
              导出
            </Button>
          )}
        </>
      ),
    },
  ];

  return (
    <>
      <ProTable
        rowKey="id"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const res: any = await request.get('/tasks', {
            params: { page: params.current, pageSize: params.pageSize },
          });
          return { data: res.data || res, total: res.total, success: true };
        }}
        toolBarRender={() => {
          const btns = [];
          if (isTeacher) {
            btns.push(
              <Button key="create" type="primary" onClick={openCreate}>
                创建任务
              </Button>,
            );
          }
          return btns;
        }}
        search={false}
      />
      <Modal
        title="创建任务"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="title" label="标题" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="scaleId" label="量表" rules={[{ required: true }]}>
            <Select
              options={scales.map((s: any) => ({
                label: s.name,
                value: s.id,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="targetIds"
            label="目标班级"
            rules={[{ required: true }]}
          >
            <Select
              mode="multiple"
              options={targets.map((c: any) => ({
                label: c.name,
                value: c.id,
              }))}
            />
          </Form.Item>
          <Form.Item name="deadline" label="截止时间">
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
