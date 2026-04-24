import { useRef } from 'react';
import { Tag, Button, message, Tooltip } from 'antd';
import { ProTable } from '@ant-design/pro-components';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import {
  ClockCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import request from '../../utils/request';

interface PendingFollowup {
  id: string;
  studentId: string;
  studentName: string;
  className: string;
  alertLevel: string;
  alertCreatedAt: string;
  status: string;
}

const levelMap: Record<string, { color: string; text: string }> = {
  red: { color: 'red', text: '红色预警' },
  yellow: { color: 'gold', text: '黄色预警' },
  green: { color: 'green', text: '正常' },
};

const statusMap: Record<string, { color: string; text: string }> = {
  pending: { color: 'default', text: '待随访' },
  interviewed: { color: 'processing', text: '已访谈' },
  followup: { color: 'warning', text: '跟进中' },
};

export default function FollowupWorkbench() {
  const actionRef = useRef<ActionType>();
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = location.pathname.startsWith('/admin') ? '/admin' : '/teacher';

  const columns: ProColumns<PendingFollowup>[] = [
    {
      title: '学生姓名',
      dataIndex: 'studentName',
      width: 120,
      render: (_: any, record: any) => record.studentName || '-',
    },
    {
      title: '班级',
      dataIndex: 'className',
      width: 150,
    },
    {
      title: '预警等级',
      dataIndex: 'alertLevel',
      width: 110,
      render: (_, record) => {
        const info = levelMap[record.alertLevel] || {
          color: 'default',
          text: record.alertLevel,
        };
        return <Tag color={info.color}>{info.text}</Tag>;
      },
    },
    {
      title: '预警时间',
      dataIndex: 'alertCreatedAt',
      width: 170,
      render: (_, record) =>
        record.alertCreatedAt
          ? new Date(record.alertCreatedAt).toLocaleString('zh-CN')
          : '-',
    },
    {
      title: '随访状态',
      dataIndex: 'status',
      width: 100,
      render: (_, record) => {
        const info = statusMap[record.status] || {
          color: 'default',
          text: record.status,
        };
        return <Tag color={info.color}>{info.text}</Tag>;
      },
    },
    {
      title: '操作',
      width: 180,
      render: (_, record) => (
        <>
          <Button
            type="link"
            onClick={() =>
              navigate(`${basePath}/students/${record.studentId}/profile`)
            }
          >
            查看档案
          </Button>
          <Button
            type="link"
            onClick={() =>
              navigate(`${basePath}/interviews`, {
                state: {
                  studentId: record.studentId,
                  studentName: record.studentName,
                },
              })
            }
          >
            发起访谈
          </Button>
        </>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <ProTable<PendingFollowup>
        rowKey="id"
        actionRef={actionRef}
        columns={columns}
        headerTitle="随访工作台"
        search={false}
        request={async () => {
          try {
            const res: any = await request.get('/followups/pending');
            const data = Array.isArray(res) ? res : [];
            return { data, total: data.length, success: true };
          } catch {
            message.error('加载随访列表失败');
            return { data: [], total: 0, success: true };
          }
        }}
        toolBarRender={() => [
          <Tooltip title="显示所有待随访学生" key="info">
            <Button icon={<ClockCircleOutlined />}>
              待随访学生列表
            </Button>
          </Tooltip>,
        ]}
        locale={{ emptyText: '暂无待随访记录' }}
      />
    </div>
  );
}
