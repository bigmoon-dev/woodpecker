import { useRef, useState } from 'react';
import { ProTable, type ActionType, type ProColumns } from '@ant-design/pro-components';
import { Button, Modal, Form, Input, message, Tag, Descriptions, Timeline, Spin } from 'antd';

import { useNavigate, useLocation } from 'react-router-dom';
import request from '../../utils/request';

export default function AlertList() {
  const actionRef = useRef<ActionType>();
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = location.pathname.startsWith('/admin') ? '/admin' : '/teacher';
  const [handleOpen, setHandleOpen] = useState(false);
  const [followupOpen, setFollowupOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [currentId, setCurrentId] = useState('');
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
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

  const openDetail = async (id: string) => {
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const res: any = await request.get(`/alerts/${id}`);
      setDetail(res);
    } catch {
      message.error('获取详情失败');
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const statusColor: Record<string, string> = { pending: 'orange', handled: 'green', followup: 'blue' };
  const statusLabel: Record<string, string> = { pending: '待处理', handled: '已处理', followup: '已随访' };
  const actionLabel: Record<string, string> = { handle: '处理', followup: '随访' };

  const columns: ProColumns[] = [
    {
      title: '学生',
      dataIndex: 'studentName',
      key: 'studentName',
      render: (_: any, record: any) => (
        <a onClick={() => openDetail(record.id)}>{record.studentName || '-'}</a>
      ),
    },
    {
      title: '等级',
      dataIndex: 'level',
      key: 'level',
      render: (_: any, record: any) => {
        const colorMap: Record<string, string> = { red: 'red', yellow: 'orange', green: 'green' };
        const labelMap: Record<string, string> = { red: '红色预警', yellow: '黄色预警', green: '正常' };
        return <Tag color={colorMap[record.level] || 'default'}>{labelMap[record.level] || record.level}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (_: any, record: any) => <Tag color={statusColor[record.status]}>{statusLabel[record.status] || record.status}</Tag>,
    },
    {
      title: '最新处理',
      dataIndex: 'handleNote',
      key: 'handleNote',
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: '预警时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (_: any, record: any) => record.createdAt ? new Date(record.createdAt).toLocaleString() : '-',
      hideInSearch: true,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <>
          <Button type="link" onClick={() => openDetail(record.id)}>
            查看
          </Button>
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
      <Modal
        title="预警详情"
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={null}
        width={640}
      >
        {detailLoading ? (
          <Spin />
        ) : detail ? (
          <>
            <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="学生">
                {detail.studentName || detail.studentId}
                {detail.studentId && (
                  <Button
                    type="link"
                    size="small"
                    onClick={() => navigate(`${basePath}/students/${detail.studentId}/profile`)}
                  >
                    查看档案
                  </Button>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="等级">
                <Tag color={({ red: 'red', yellow: 'orange', green: 'green' } as Record<string, string>)[detail.level] || 'default'}>
                  {({ red: '红色预警', yellow: '黄色预警', green: '正常' } as Record<string, string>)[detail.level] || detail.level}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusColor[detail.status]}>{statusLabel[detail.status] || detail.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="预警时间">
                {detail.createdAt ? new Date(detail.createdAt).toLocaleString() : '-'}
              </Descriptions.Item>
              {detail.handleNote && (
                <Descriptions.Item label="最新备注" span={2}>{detail.handleNote}</Descriptions.Item>
              )}
            </Descriptions>
            <h4 style={{ marginBottom: 12 }}>处理记录</h4>
            {detail.handlingHistory && detail.handlingHistory.length > 0 ? (
              <Timeline
                items={detail.handlingHistory.map((h: any) => ({
                  color: h.action === 'handle' ? 'green' : 'blue',
                  children: (
                    <div>
                      <div style={{ fontWeight: 500 }}>
                        {actionLabel[h.action] || h.action}
                        <span style={{ color: '#999', fontWeight: 'normal', marginLeft: 8, fontSize: 12 }}>
                          {h.createdAt ? new Date(h.createdAt).toLocaleString() : ''}
                        </span>
                      </div>
                      <div style={{ marginTop: 4 }}>{h.note}</div>
                    </div>
                  ),
                }))}
              />
            ) : (
              <div style={{ color: '#999' }}>暂无处理记录</div>
            )}
          </>
        ) : (
          <div>加载失败</div>
        )}
      </Modal>
    </>
  );
}
