import { useRef, useState } from 'react';
import { ProTable, type ActionType, type ProColumns } from '@ant-design/pro-components';
import { Button, Modal, Form, Input, message, Tag } from 'antd';
import request from '../../utils/request';

export default function AlertList() {
  const actionRef = useRef<ActionType>();
  const [handleOpen, setHandleOpen] = useState(false);
  const [followupOpen, setFollowupOpen] = useState(false);
  const [currentId, setCurrentId] = useState('');
  const [form] = Form.useForm();

  const doAction = async (action: 'handle' | 'followup') => {
    const values = await form.validateFields();
    try {
      await request.post(`/alerts/${currentId}/${action}`, { handleNote: values.handleNote });
      message.success('操作成功');
      (action === 'handle' ? setHandleOpen : setFollowupOpen)(false);
      form.resetFields();
      actionRef.current?.reload();
    } catch {
      message.error('操作失败');
    }
  };

  const statusColor: Record<string, string> = { pending: 'orange', handled: 'green', followup: 'blue' };

  const columns: ProColumns[] = [
    { title: 'ID', dataIndex: 'id', key: 'id', ellipsis: true },
    { title: '学生ID', dataIndex: 'studentId', key: 'studentId', ellipsis: true },
    { title: '类型', dataIndex: 'alertType', key: 'alertType' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (_: any, record: any) => <Tag color={statusColor[record.status]}>{record.status}</Tag> },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', render: (_: any, record: any) => record.createdAt ? new Date(record.createdAt).toLocaleString() : '-' },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <>
          <Button type="link" disabled={record.status !== 'pending'} onClick={() => { setCurrentId(record.id); setHandleOpen(true); }}>
            处理
          </Button>
          <Button type="link" onClick={() => { setCurrentId(record.id); setFollowupOpen(true); }}>
            随访
          </Button>
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
          const res: any = await request.get('/alerts', { params: { page: params.current, pageSize: params.pageSize } });
          return { data: res.data || res, total: res.total, success: true };
        }}
        search={false}
      />
      <Modal title="处理预警" open={handleOpen} onCancel={() => setHandleOpen(false)} onOk={() => doAction('handle')}>
        <Form form={form} layout="vertical">
          <Form.Item name="handleNote" label="处理备注" rules={[{ required: true }]}>
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>
      <Modal title="随访记录" open={followupOpen} onCancel={() => setFollowupOpen(false)} onOk={() => doAction('followup')}>
        <Form form={form} layout="vertical">
          <Form.Item name="handleNote" label="随访备注" rules={[{ required: true }]}>
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
