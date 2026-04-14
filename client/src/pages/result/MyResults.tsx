import { useRef } from 'react';
import { ProTable, type ActionType, type ProColumns } from '@ant-design/pro-components';
import request from '../../utils/request';

export default function MyResults() {
  const actionRef = useRef<ActionType>();

  const columns: ProColumns[] = [
    { title: '结果ID', dataIndex: 'id', key: 'id', ellipsis: true },
    { title: '总分', dataIndex: 'totalScore', key: 'totalScore' },
    { title: '等级', dataIndex: 'level', key: 'level' },
    { title: '颜色', dataIndex: 'color', key: 'color' },
    { title: '建议', dataIndex: 'suggestion', key: 'suggestion', ellipsis: true },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', render: (_: any, record: any) => record.createdAt ? new Date(record.createdAt).toLocaleString() : '-' },
  ];

  return (
    <ProTable
      rowKey="id"
      actionRef={actionRef}
      columns={columns}
      request={async (params) => {
        const res: any = await request.get('/results/me');
        const data = Array.isArray(res) ? res : res.data || [];
        const start = ((params.current || 1) - 1) * (params.pageSize || 20);
        const end = start + (params.pageSize || 20);
        return { data: data.slice(start, end), total: data.length, success: true };
      }}
      search={false}
    />
  );
}
