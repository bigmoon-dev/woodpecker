import { useRef, useState } from 'react';
import { ProTable, type ActionType, type ProColumns } from '@ant-design/pro-components';
import { Button, Tag, message } from 'antd';
import { AppstoreOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import request from '../../utils/request';

export default function ScaleLibrary() {
  const actionRef = useRef<ActionType>();
  const [cloning, setCloning] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const basePath = location.pathname.startsWith('/admin') ? '/admin' : '/teacher';

  const handleClone = async (id: string) => {
    setCloning(id);
    try {
      const res: any = await request.post(`/scales/library/${id}/clone`);
      message.success('选用成功');
      navigate(`${basePath}/scales/${res.id}`);
    } catch (err: any) {
      const msg = err.response?.data?.message || '选用失败';
      message.error(msg);
    } finally {
      setCloning(null);
    }
  };

  const columns: ProColumns[] = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '版本', dataIndex: 'version', key: 'version', width: 80 },
    {
      title: '题目数',
      key: 'itemCount',
      width: 100,
      render: (_: any, record: any) => record.items?.length ?? '-',
    },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: '状态',
      key: 'status',
      width: 80,
      render: () => <Tag color="blue">库</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: any) => (
        <Button
          type="link"
          loading={cloning === record.id}
          onClick={() => handleClone(record.id)}
        >
          选用
        </Button>
      ),
    },
  ];

  return (
    <ProTable
      rowKey="id"
      actionRef={actionRef}
      columns={columns}
      headerTitle="量表库"
      request={async () => {
        const res: any = await request.get('/scales/library');
        const data = Array.isArray(res) ? res : res.data || [];
        return { data, total: data.length, success: true };
      }}
      search={false}
      toolBarRender={false}
    />
  );
}
