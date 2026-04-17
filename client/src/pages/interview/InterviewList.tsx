import { useRef, useState, useEffect } from 'react';
import { ProTable, type ActionType } from '@ant-design/pro-components';
import { Button, Modal, Form, Input, Select, DatePicker, Tag, message, Popconfirm } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import request from '../../utils/request';

const statusMap: Record<string, { color: string; text: string }> = {
  draft: { color: 'blue', text: '草稿' },
  reviewed: { color: 'orange', text: '已审阅' },
  completed: { color: 'green', text: '已完成' },
};

const riskMap: Record<string, { color: string; text: string }> = {
  normal: { color: 'green', text: '一般' },
  attention: { color: 'blue', text: '关注' },
  warning: { color: 'orange', text: '重点' },
  crisis: { color: 'red', text: '危机' },
};

export default function InterviewList() {
  const actionRef = useRef<ActionType>();
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = location.pathname.startsWith('/admin') ? '/admin' : '/teacher';

  useEffect(() => {
    request.get('/interviews/templates/all').then((res: any) => {
      const list = res.data || res;
      setTemplates(Array.isArray(list) ? list : []);
    });
  }, []);

  const handleCreate = async (values: any) => {
    try {
      const payload = {
        ...values,
        interviewDate: values.interviewDate?.format('YYYY-MM-DD HH:mm:ss'),
      };
      await request.post('/interviews', payload);
      message.success('创建成功');
      setOpen(false);
      form.resetFields();
      actionRef.current?.reload();
    } catch {
      message.error('创建失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await request.delete(`/interviews/${id}`);
      message.success('删除成功');
      actionRef.current?.reload();
    } catch {
      message.error('删除失败');
    }
  };

  const columns = [
    { title: '学生姓名', dataIndex: 'studentName', key: 'studentName' },
    {
      title: '访谈日期',
      dataIndex: 'interviewDate',
      key: 'interviewDate',
      render: (_: any, record: any) =>
        record.interviewDate ? new Date(record.interviewDate).toLocaleString() : '-',
    },
    {
      title: '风险等级',
      dataIndex: 'riskLevel',
      key: 'riskLevel',
      render: (_: any, record: any) => {
        const item = riskMap[record.riskLevel];
        return item ? <Tag color={item.color}>{item.text}</Tag> : '-';
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (_: any, record: any) => {
        const item = statusMap[record.status];
        return item ? <Tag color={item.color}>{item.text}</Tag> : '-';
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_: any, record: any) => (
        <>
          <Button type="link" onClick={() => navigate(`${basePath}/interviews/${record.id}`)}>
            查看
          </Button>
          <Popconfirm
            title="确定删除此访谈？"
            onConfirm={() => handleDelete(record.id)}
            okText="删除"
            cancelText="取消"
          >
            <Button type="link" danger>删除</Button>
          </Popconfirm>
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
          const res: any = await request.get('/interviews', {
            params: { page: params.current, pageSize: params.pageSize },
          });
          return { data: res.data || res, total: res.total, success: true };
        }}
        toolBarRender={() => [
          <Button key="create" type="primary" onClick={() => setOpen(true)}>
            新建访谈
          </Button>,
        ]}
        search={false}
      />
      <Modal
        title="新建访谈"
        open={open}
        onCancel={() => { setOpen(false); form.resetFields(); }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="studentId" label="学生" rules={[{ required: true, message: '请选择学生' }]}>
            <Select placeholder="选择学生" />
          </Form.Item>
          <Form.Item name="psychologistId" label="心理老师" rules={[{ required: true, message: '请选择心理老师' }]}>
            <Select placeholder="选择心理老师" />
          </Form.Item>
          <Form.Item name="interviewDate" label="访谈日期" rules={[{ required: true, message: '请选择日期' }]}>
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="location" label="地点">
            <Input placeholder="访谈地点" />
          </Form.Item>
          <Form.Item name="riskLevel" label="风险等级" rules={[{ required: true, message: '请选择风险等级' }]}>
            <Select placeholder="选择风险等级">
              {Object.entries(riskMap).map(([key, val]) => (
                <Select.Option key={key} value={key}>{val.text}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="templateId" label="访谈模板">
            <Select placeholder="选择模板" allowClear>
              {templates.map((t: any) => (
                <Select.Option key={t.id} value={t.id}>{t.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
