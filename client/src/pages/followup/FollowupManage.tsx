import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProTable, type ActionType } from '@ant-design/pro-components';
import { Card, Select, Button, Empty, Descriptions, Spin, Tag, Typography } from 'antd';
import request from '../../utils/request';

const basePath = location.pathname.startsWith('/admin') ? '/admin' : '/teacher';

const colorTag = (color: string) => {
  const map: Record<string, { label: string; c: string }> = {
    red: { label: '红色', c: 'red' },
    yellow: { label: '黄色', c: 'orange' },
    green: { label: '绿色', c: 'green' },
  };
  const item = map[color] || { label: color, c: 'default' };
  return <Tag color={item.c}>{item.label}</Tag>;
};

export default function FollowupManage() {
  const actionRef = useRef<ActionType>();
  const navigate = useNavigate();
  const [threshold, setThreshold] = useState<string>('yellow');

  useEffect(() => {
    request.get('/followup-manage/config').then((res: any) => {
      if (res?.threshold) setThreshold(res.threshold);
    });
  }, []);

  const handleThresholdChange = async (value: string) => {
    try {
      await request.put('/followup-manage/config', { threshold: value });
      setThreshold(value);
      actionRef.current?.reload();
    } catch {
      // ignore
    }
  };

  const columns = [
    { title: '学生姓名', dataIndex: 'studentName', key: 'studentName' },
    { title: '班级', dataIndex: 'className', key: 'className' },
    {
      title: '风险等级',
      dataIndex: 'riskLevel',
      key: 'riskLevel',
      render: (_: any, record: any) => record.riskLevel || '-',
    },
    {
      title: '风险颜色',
      dataIndex: 'riskColor',
      key: 'riskColor',
      render: (_: any, record: any) => record.riskColor ? colorTag(record.riskColor) : '-',
    },
    { title: '访谈次数', dataIndex: 'interviewCount', key: 'interviewCount' },
    {
      title: '最近访谈',
      dataIndex: 'lastInterviewDate',
      key: 'lastInterviewDate',
      render: (_: any, record: any) =>
        record.lastInterviewDate ? new Date(record.lastInterviewDate).toLocaleDateString() : '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (_: any, record: any) => {
        const map: Record<string, { label: string; color: string }> = {
          at_risk: { label: '待随访', color: 'red' },
          interviewed: { label: '已访谈', color: 'blue' },
        };
        const s = map[record.status] || { label: record.status, color: 'default' };
        return <Tag color={s.color}>{s.label}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: any) => (
        <Button
          type="link"
          onClick={() => navigate(`${basePath}/students/${record.studentId}/profile`)}
        >
          查看详情
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <span style={{ marginRight: 8 }}>风险阈值：</span>
        <Select
          value={threshold}
          onChange={handleThresholdChange}
          style={{ width: 120 }}
          options={[
            { label: '黄色及以上', value: 'yellow' },
            { label: '仅红色', value: 'red' },
          ]}
        />
      </Card>
      <ProTable
        rowKey="studentId"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const res: any = await request.get('/followup-manage/students', {
            params: { page: params.current, pageSize: params.pageSize },
          });
          return { data: res.data || [], total: res.total || 0, success: true };
        }}
        search={false}
        locale={{ emptyText: <Empty description="暂无需要随访的学生" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
      />
    </div>
  );
}
