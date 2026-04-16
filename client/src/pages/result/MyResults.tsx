import { useRef } from 'react';
import { ProTable, type ActionType, type ProColumns } from '@ant-design/pro-components';
import request from '../../utils/request';

export default function MyResults() {
  const actionRef = useRef<ActionType>();

  const isStudent = (() => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      return (user.roles || []).some((r: any) => r.name === 'student');
    } catch {
      return false;
    }
  })();

  const columns: ProColumns[] = [
    { title: '总分', dataIndex: 'totalScore', key: 'totalScore' },
    { title: '等级', dataIndex: 'level', key: 'level' },
    {
      title: '颜色',
      dataIndex: 'color',
      key: 'color',
      render: (_: any, record: any) => {
        const colorMap: Record<string, string> = { red: '红色', yellow: '黄色', green: '绿色', gray: '灰色' };
        return colorMap[record.color] || record.color;
      },
    },
    { title: '建议', dataIndex: 'suggestion', key: 'suggestion', ellipsis: true },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', render: (_: any, record: any) => record.createdAt ? new Date(record.createdAt).toLocaleString() : '-' },
  ];

  return (
    <ProTable
      rowKey="id"
      actionRef={actionRef}
      columns={columns}
      request={async (params) => {
        const url = isStudent ? '/results/me' : '/results';
        const res: any = await request.get(url);
        const data = Array.isArray(res) ? res : res.data || [];
        const start = ((params.current || 1) - 1) * (params.pageSize || 20);
        const end = start + (params.pageSize || 20);
        return { data: data.slice(start, end), total: data.length, success: true };
      }}
      search={false}
    />
  );
}
