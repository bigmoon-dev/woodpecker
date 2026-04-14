import { useRef } from 'react';
import { ProTable, type ActionType } from '@ant-design/pro-components';
import { useParams } from 'react-router-dom';
import request from '../../utils/request';

export default function GradeResults() {
  const { gradeId } = useParams();
  const actionRef = useRef<ActionType>();

  const columns = [
    { title: '学生ID', dataIndex: 'studentId', key: 'studentId', ellipsis: true },
    { title: '总分', dataIndex: 'totalScore', key: 'totalScore' },
    { title: '等级', dataIndex: 'level', key: 'level' },
    { title: '颜色', dataIndex: 'color', key: 'color' },
    { title: '建议', dataIndex: 'suggestion', key: 'suggestion', ellipsis: true },
  ];

  return (
    <ProTable
      rowKey="id"
      actionRef={actionRef}
      columns={columns}
      request={async () => {
        const res: any = await request.get(`/results/grade/${gradeId}`);
        const data = Array.isArray(res) ? res : res.data || [];
        return { data, total: data.length, success: true };
      }}
      search={false}
    />
  );
}
