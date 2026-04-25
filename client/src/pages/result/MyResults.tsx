import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProTable, type ActionType, type ProColumns } from '@ant-design/pro-components';
import { Button, Select, Space } from 'antd';
import request from '../../utils/request';

export default function MyResults() {
  const actionRef = useRef<ActionType>();
  const navigate = useNavigate();
  const [classes, setClasses] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);

  const isStudent = (() => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      return (user.roles || []).some((r: any) => r.name === 'student');
    } catch {
      return false;
    }
  })();

  const basePath = location.pathname.startsWith('/admin') ? '/admin/results' : '/teacher/results';

  useEffect(() => {
    if (!isStudent) {
      request.get('/admin/classes').then((res: any) => {
        const data = Array.isArray(res) ? res : res.data || [];
        setClasses(data);
      }).catch(() => {});
      request.get('/admin/grades').then((res: any) => {
        const data = Array.isArray(res) ? res : res.data || [];
        setGrades(data);
      }).catch(() => {});
    }
  }, [isStudent]);

  const columns: ProColumns[] = [
    ...(!isStudent
      ? [
          { title: '学生姓名', dataIndex: 'studentName', key: 'studentName', render: (_: any, record: any) => record.studentName || '-' },
          { title: '班级', dataIndex: 'className', key: 'className' },
          { title: '量表', dataIndex: 'scaleName', key: 'scaleName' },
        ]
      : []),
    {
      title: '总分',
      dataIndex: ['result', 'totalScore'],
      key: 'totalScore',
      render: (_: any, record: any) => record.result?.totalScore ?? record.totalScore,
    },
    {
      title: '等级',
      dataIndex: ['result', 'level'],
      key: 'level',
      render: (_: any, record: any) => record.result?.level ?? record.level,
    },
    {
      title: '颜色',
      key: 'color',
      render: (_: any, record: any) => {
        const color = record.result?.color ?? record.color;
        const colorMap: Record<string, string> = {
          red: '红色',
          yellow: '黄色',
          green: '绿色',
          gray: '灰色',
        };
        return colorMap[color] || color;
      },
    },
    {
      title: '建议',
      key: 'suggestion',
      ellipsis: true,
      render: (_: any, record: any) => record.result?.suggestion ?? record.suggestion,
    },
    {
      title: '创建时间',
      key: 'createdAt',
      render: (_: any, record: any) => {
        const date = record.result?.createdAt ?? record.createdAt;
        return date ? new Date(date).toLocaleString() : '-';
      },
    },
    ...(!isStudent
      ? [
          {
            title: '操作',
            key: 'action',
            width: 100,
            render: (_: any, record: any) => (
              <Button
                type="link"
                onClick={() =>
                  navigate(`${basePath}/${record.result?.id ?? record.id}`)
                }
              >
                查看详情
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <>
      {!isStudent && (classes.length > 0 || grades.length > 0) && (
        <div style={{ marginBottom: 16 }}>
          <Space>
            {classes.length > 0 && (
              <Select
                style={{ width: 200 }}
                placeholder="按班级查看"
                allowClear
                onChange={(classId) => {
                  if (classId) navigate(`${basePath}/class/${classId}`);
                }}
                options={classes.map((c: any) => ({ label: c.name, value: c.id }))}
              />
            )}
            {grades.length > 0 && (
              <Select
                style={{ width: 200 }}
                placeholder="按年级查看"
                allowClear
                onChange={(gradeId) => {
                  if (gradeId) navigate(`${basePath}/grade/${gradeId}`);
                }}
                options={grades.map((g: any) => ({ label: g.name, value: g.id }))}
              />
            )}
          </Space>
        </div>
      )}
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
    </>
  );
}
