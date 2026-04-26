import { useRef, useState } from 'react';
import { ProTable, type ActionType } from '@ant-design/pro-components';
import { Tag, DatePicker, Select, Space, Button } from 'antd';
import request from '../../utils/request';

const { RangePicker } = DatePicker;

const entityTypeOptions = [
  { label: '全部', value: '' },
  { label: '学生', value: 'student' },
  { label: '班级', value: 'class' },
  { label: '年级', value: 'grade' },
  { label: '访谈', value: 'interview' },
  { label: '预警', value: 'alert' },
];

const actionColorMap: Record<string, string> = {
  'student.update_status': 'orange',
  'student.update': 'blue',
  'grade.update_status': 'orange',
  'class.update_status': 'orange',
  'interview.create': 'green',
  'interview.update': 'blue',
  'alert.handle': 'green',
  'alert.followup': 'purple',
};

const entityLabel: Record<string, string> = {
  student: '学生',
  class: '班级',
  grade: '年级',
  interview: '访谈',
  alert: '预警',
  task: '任务',
};

export default function AuditLogPage() {
  const actionRef = useRef<ActionType>();
  const [entityType, setEntityType] = useState<string>('');
  const [dateRange, setDateRange] = useState<[Date, Date] | null>(null);

  const buildParams = (page: number, pageSize: number) => {
    const params: Record<string, unknown> = { page, limit: pageSize };
    if (entityType) params.entityType = entityType;
    if (dateRange?.[0]) params.startDate = dateRange[0].toISOString();
    if (dateRange?.[1]) params.endDate = dateRange[1].toISOString();
    return params;
  };

  const columns = [
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (_: any, record: any) =>
        record.createdAt ? new Date(record.createdAt).toLocaleString('zh-CN') : '-',
    },
    {
      title: '操作者',
      dataIndex: 'operatorName',
      key: 'operatorName',
      width: 120,
    },
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      width: 180,
      render: (_: any, record: any) => (
        <Tag color={actionColorMap[record.action] || 'default'}>{record.action}</Tag>
      ),
    },
    {
      title: '目标类型',
      dataIndex: 'entityType',
      key: 'entityType',
      width: 100,
      render: (_: any, record: any) => entityLabel[record.entityType] || record.entityType,
    },
    {
      title: '目标ID',
      dataIndex: 'entityId',
      key: 'entityId',
      width: 120,
      ellipsis: true,
    },
    {
      title: '变更内容',
      dataIndex: 'changes',
      key: 'changes',
      ellipsis: true,
      render: (_: any, record: any) => {
        const val = record.changes;
        if (!val) return '-';
        return Object.entries(val)
          .map(
            ([k, v]: [string, any]) =>
              `${k}: ${JSON.stringify(v.before)} → ${JSON.stringify(v.after)}`,
          )
          .join('; ');
      },
    },
    {
      title: 'IP',
      dataIndex: 'ip',
      key: 'ip',
      width: 130,
    },
  ];

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Select
          value={entityType}
          onChange={setEntityType}
          options={entityTypeOptions}
          style={{ width: 120 }}
          placeholder="目标类型"
        />
        <RangePicker
          onChange={(dates) => {
            if (dates?.[0] && dates?.[1]) {
              setDateRange([
                dates[0].startOf('day').toDate(),
                dates[1].endOf('day').toDate(),
              ]);
            } else {
              setDateRange(null);
            }
          }}
        />
        <Button type="primary" onClick={() => actionRef.current?.reload()}>
          查询
        </Button>
      </Space>
      <ProTable
        rowKey="id"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const res: any = await request.get('/admin/audit-logs', {
            params: buildParams(params.current || 1, params.pageSize || 20),
          });
          return {
            data: res.data || [],
            total: res.total || 0,
            success: true,
          };
        }}
        search={false}
        pagination={{
          defaultPageSize: 20,
          showSizeChanger: true,
        }}
        options={{ reload: true, density: false, fullScreen: false }}
      />
    </>
  );
}
