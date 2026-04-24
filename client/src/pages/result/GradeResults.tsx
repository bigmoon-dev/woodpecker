import { useRef } from 'react';
import { ProTable, type ActionType } from '@ant-design/pro-components';
import { Button } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import request from '../../utils/request';

export default function GradeResults() {
  const { gradeId } = useParams();
  const actionRef = useRef<ActionType>();

  const columns = [
    { title: '学生', dataIndex: 'studentName', key: 'studentName', render: (_: any, record: any) => record.studentName || '-' },
    { title: '学号', dataIndex: 'studentNumber', key: 'studentNumber' },
    { title: '量表', dataIndex: 'scaleName', key: 'scaleName', ellipsis: true },
    { title: '总分', dataIndex: 'totalScore', key: 'totalScore' },
    { title: '等级', dataIndex: 'level', key: 'level' },
    {
      title: '建议',
      dataIndex: 'suggestion',
      key: 'suggestion',
      ellipsis: true,
    },
  ];

  return (
    <ProTable
      rowKey="id"
      actionRef={actionRef}
      columns={columns}
      request={async (params) => {
        const res: any = await request.get(`/results/grade/${gradeId}`, {
          params: { page: params.current, pageSize: params.pageSize },
        });
        const data = Array.isArray(res) ? res : res.data || [];
        const total = res.total || data.length;
        return { data, total, success: true };
      }}
      toolBarRender={() => [
        <Button
          key="export"
          icon={<DownloadOutlined />}
          href={`/api/export/excel?gradeId=${gradeId}`}
          target="_blank"
        >
          导出 Excel
        </Button>,
      ]}
      search={false}
    />
  );
}
