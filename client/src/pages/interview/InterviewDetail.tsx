import { useEffect, useState } from 'react';
import { Card, Tabs, Descriptions, Button, Modal, Form, Input, Select, DatePicker, Tag, Spin, Space, message } from 'antd';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import dayjs from 'dayjs';
import request from '../../utils/request';
import FileUpload from './FileUpload';
import SummaryView from './SummaryView';

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

export default function InterviewDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = location.pathname.startsWith('/admin') ? '/admin' : '/teacher';

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm] = Form.useForm();

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res: any = await request.get(`/interviews/${id}`);
      setData(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleUpdate = async (values: any) => {
    try {
      const payload = {
        ...values,
        interviewDate: values.interviewDate?.format('YYYY-MM-DD HH:mm:ss'),
      };
      await request.put(`/interviews/${id}`, payload);
      message.success('更新成功');
      setEditOpen(false);
      editForm.resetFields();
      loadData();
    } catch {
      message.error('更新失败');
    }
  };

  const handleStatusTransition = async (status: string) => {
    try {
      await request.put(`/interviews/${id}`, { status });
      message.success('状态更新成功');
      loadData();
    } catch {
      message.error('状态更新失败');
    }
  };

  if (loading) return <Spin />;
  if (!data) return <Card>未找到访谈记录</Card>;

  const statusItem = statusMap[data.status] || { color: 'default', text: data.status };
  const riskItem = riskMap[data.riskLevel] || { color: 'default', text: data.riskLevel };

  return (
    <>
      <Card
        title="访谈详情"
        extra={
          <Button onClick={() => navigate(`${basePath}/interviews`)}>返回</Button>
        }
      >
        <Tabs
          defaultActiveKey="info"
          items={[
            {
              key: 'info',
              label: '基本信息',
              children: (
                <>
                  <Descriptions bordered column={2} style={{ marginBottom: 16 }}>
                    <Descriptions.Item label="学生姓名">{data.studentName || '-'}</Descriptions.Item>
                    <Descriptions.Item label="心理老师">{data.psychologistName || '-'}</Descriptions.Item>
                    <Descriptions.Item label="访谈日期">
                      {data.interviewDate ? new Date(data.interviewDate).toLocaleString() : '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="地点">{data.location || '-'}</Descriptions.Item>
                    <Descriptions.Item label="风险等级">
                      <Tag color={riskItem.color}>{riskItem.text}</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="状态">
                      <Tag color={statusItem.color}>{statusItem.text}</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="备注" span={2}>{data.notes || '-'}</Descriptions.Item>
                  </Descriptions>
                  <Space>
                    <Button
                      type="primary"
                      onClick={() => {
                        editForm.setFieldsValue({
                          ...data,
                          interviewDate: data.interviewDate
                            ? dayjs(data.interviewDate)
                            : undefined,
                        });
                        setEditOpen(true);
                      }}
                    >
                      编辑
                    </Button>
                    {data.status === 'draft' && (
                      <Button onClick={() => handleStatusTransition('reviewed')}>标记为已审阅</Button>
                    )}
                    {data.status === 'reviewed' && (
                      <Button onClick={() => handleStatusTransition('completed')}>标记为已完成</Button>
                    )}
                  </Space>
                </>
              ),
            },
            {
              key: 'files',
              label: '文件管理',
              children: <FileUpload interviewId={id!} />,
            },
            {
              key: 'summary',
              label: '结构化摘要',
              children: (
                <SummaryView
                  interviewId={id!}
                  ocrText={data.ocrText || null}
                  structuredSummary={data.structuredSummary || null}
                  onReload={loadData}
                />
              ),
            },
          ]}
        />
      </Card>
      <Modal
        title="编辑访谈"
        open={editOpen}
        onCancel={() => { setEditOpen(false); editForm.resetFields(); }}
        onOk={() => editForm.submit()}
        width={600}
      >
        <Form form={editForm} layout="vertical" onFinish={handleUpdate}>
          <Form.Item name="studentId" label="学生">
            <Select placeholder="选择学生" />
          </Form.Item>
          <Form.Item name="psychologistId" label="心理老师">
            <Select placeholder="选择心理老师" />
          </Form.Item>
          <Form.Item name="interviewDate" label="访谈日期">
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="location" label="地点">
            <Input />
          </Form.Item>
          <Form.Item name="riskLevel" label="风险等级">
            <Select placeholder="选择风险等级">
              {Object.entries(riskMap).map(([key, val]) => (
                <Select.Option key={key} value={key}>{val.text}</Select.Option>
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
