import { useRef, useState, useEffect } from 'react';
import { ProTable, type ActionType } from '@ant-design/pro-components';
import { Button, Modal, Form, Input, Select, DatePicker, Tabs, Tag, message } from 'antd';
import request from '../../utils/request';

export default function FollowUpManage() {
  const actionRef = useRef<ActionType>();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('pending');
  const [interviews, setInterviews] = useState<any[]>([]);
  const [form] = Form.useForm();

  useEffect(() => {
    request.get('/interviews', { params: { pageSize: 200 } }).then((res: any) => {
      const list = res.data || res;
      setInterviews(Array.isArray(list) ? list : []);
    });
  }, []);

  const handleCreate = async (values: any) => {
    try {
      const payload = {
        studentId: values.studentId,
        reminderDate: values.reminderDate?.format('YYYY-MM-DD'),
        notes: values.notes,
      };
      await request.post(`/interviews/${values.interviewId}/follow-up`, payload);
      message.success('创建成功');
      setOpen(false);
      form.resetFields();
      actionRef.current?.reload();
    } catch {
      message.error('创建失败');
    }
  };

  const handleComplete = async (id: string) => {
    try {
      await request.put(`/interviews/follow-ups/${id}/complete`);
      message.success('已标记完成');
      actionRef.current?.reload();
    } catch {
      message.error('操作失败');
    }
  };

  const statusTag = (completed: boolean) =>
    completed ? <Tag color="green">已完成</Tag> : <Tag color="orange">待处理</Tag>;

  const columns = [
    { title: '学生', dataIndex: 'studentName', key: 'studentName' },
    {
      title: '提醒日期',
      dataIndex: 'reminderDate',
      key: 'reminderDate',
      render: (_: any, record: any) =>
        record.reminderDate ? new Date(record.reminderDate).toLocaleDateString() : '-',
    },
    { title: '备注', dataIndex: 'notes', key: 'notes', ellipsis: true },
    {
      title: '状态',
      key: 'status',
      render: (_: any, record: any) => statusTag(!!record.completed),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: any) => (
        <>
          {!record.completed && (
            <Button type="link" onClick={() => handleComplete(record.id)}>
              标记完成
            </Button>
          )}
        </>
      ),
    },
  ];

  return (
    <>
      <Tabs
        activeKey={activeTab}
        onChange={(key) => { setActiveTab(key); actionRef.current?.reload(); }}
        items={[
          { key: 'pending', label: '待处理' },
          { key: 'completed', label: '已完成' },
        ]}
        style={{ marginBottom: 16 }}
      />
      <ProTable
        rowKey="id"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const res: any = await request.get('/interviews/follow-ups/pending', {
            params: {
              page: params.current,
              pageSize: params.pageSize,
              completed: activeTab === 'completed',
            },
          });
          return { data: res.data || res, total: res.total, success: true };
        }}
        toolBarRender={() => [
          <Button key="create" type="primary" onClick={() => setOpen(true)}>
            新建随访
          </Button>,
        ]}
        search={false}
      />
      <Modal
        title="新建随访"
        open={open}
        onCancel={() => { setOpen(false); form.resetFields(); }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="interviewId" label="关联访谈" rules={[{ required: true, message: '请选择访谈' }]}>
            <Select placeholder="选择访谈" showSearch optionFilterProp="children">
              {interviews.map((iv: any) => (
                <Select.Option key={iv.id} value={iv.id}>
                  {iv.studentName || iv.id} - {iv.interviewDate ? new Date(iv.interviewDate).toLocaleDateString() : ''}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="studentId" label="学生ID">
            <Input placeholder="学生ID（可从访谈自动获取）" />
          </Form.Item>
          <Form.Item name="reminderDate" label="提醒日期" rules={[{ required: true, message: '请选择日期' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
