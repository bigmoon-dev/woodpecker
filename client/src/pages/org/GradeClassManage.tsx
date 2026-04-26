import { useRef, useState, useEffect } from 'react';
import { ProTable, type ActionType } from '@ant-design/pro-components';
import {
  Button,
  Modal,
  Form,
  Input,
  Select,
  Tag,
  message,
  Popconfirm,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import request from '../../utils/request';

export default function GradeClassManage() {
  const actionRef = useRef<ActionType>();
  const [grades, setGrades] = useState<any[]>([]);
  const [selectedGradeId, setSelectedGradeId] = useState<string | null>(null);
  const [classOpen, setClassOpen] = useState(false);
  const [classForm] = Form.useForm();

  useEffect(() => {
    request
      .get('/admin/grades', { params: { page: 1, pageSize: 100 } })
      .then((res: any) => {
        const list = res.data || res || [];
        setGrades(list);
        if (list.length > 0 && !selectedGradeId) {
          setSelectedGradeId(list[0].id);
        }
      });
  }, []);

  const handleCreateClass = async (values: any) => {
    try {
      await request.post('/admin/classes', {
        ...values,
        gradeId: selectedGradeId,
      });
      message.success('班级创建成功');
      setClassOpen(false);
      classForm.resetFields();
      actionRef.current?.reload();
    } catch {
      message.error('创建失败');
    }
  };

  const handleArchiveGrade = async (id: string) => {
    try {
      await request.patch(`/admin/grades/${id}/status`, {
        status: 'archived',
      });
      message.success('年级已归档');
      setGrades((prev) =>
        prev.map((g) => (g.id === id ? { ...g, status: 'archived' } : g)),
      );
    } catch {
      message.error('操作失败');
    }
  };

  const handleArchiveClass = async (id: string) => {
    try {
      await request.patch(`/admin/classes/${id}/status`, {
        status: 'archived',
      });
      message.success('班级已归档');
      actionRef.current?.reload();
    } catch {
      message.error('操作失败');
    }
  };

  const selectedGrade = grades.find((g) => g.id === selectedGradeId);

  const classColumns = [
    { title: '班级名称', dataIndex: 'name', key: 'name' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (_: any, record: any) =>
        record.status === 'archived' ? (
          <Tag color="default">已归档</Tag>
        ) : (
          <Tag color="green">在读</Tag>
        ),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: any) =>
        record.status === 'archived' ? null : (
          <Popconfirm
            title="确认归档该班级？"
            onConfirm={() => handleArchiveClass(record.id)}
          >
            <Button type="link" size="small">
              归档
            </Button>
          </Popconfirm>
        ),
    },
  ];

  return (
    <div style={{ display: 'flex', gap: 16 }}>
      <div
        style={{
          width: 160,
          flexShrink: 0,
          borderRight: '1px solid #f0f0f0',
          paddingRight: 8,
        }}
      >
        <div
          style={{
            fontWeight: 600,
            marginBottom: 12,
            fontSize: 15,
          }}
        >
          年级
        </div>
        {grades.map((grade) => {
          const isActive = grade.id === selectedGradeId;
          const isArchived = grade.status === 'archived';
          return (
            <div
              key={grade.id}
              onClick={() => setSelectedGradeId(grade.id)}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                borderRadius: 6,
                marginBottom: 4,
                background: isActive ? '#e6f4ff' : 'transparent',
                color: isArchived ? '#999' : undefined,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>
                {isArchived ? <Tag color="default">归档</Tag> : null}
                {grade.name}
              </span>
              {!isArchived && (
                <Popconfirm
                  title="确认归档该年级？"
                  onConfirm={(e) => {
                    e?.stopPropagation();
                    handleArchiveGrade(grade.id);
                  }}
                  onCancel={(e) => e?.stopPropagation()}
                >
                  <Button
                    type="text"
                    size="small"
                    danger
                    onClick={(e) => e.stopPropagation()}
                    style={{ fontSize: 12 }}
                  >
                    归档
                  </Button>
                </Popconfirm>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ flex: 1 }}>
        <ProTable
          rowKey="id"
          actionRef={actionRef}
          columns={classColumns}
          request={async (params) => {
            if (!selectedGradeId) return { data: [], total: 0, success: true };
            const res: any = await request.get('/admin/classes', {
              params: {
                page: params.current,
                pageSize: params.pageSize,
                gradeId: selectedGradeId,
              },
            });
            return {
              data: res.data || res || [],
              total: res.total || 0,
              success: true,
            };
          }}
          toolBarRender={() => [
            <Button
              key="create"
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setClassOpen(true)}
              disabled={!selectedGradeId || selectedGrade?.status === 'archived'}
            >
              新建班级
            </Button>,
          ]}
          search={false}
          headerTitle={selectedGrade ? `${selectedGrade.name} — 班级列表` : '班级列表'}
          pagination={{ defaultPageSize: 20 }}
        />
      </div>

      <Modal
        title={`在 ${selectedGrade?.name || ''} 下新建班级`}
        open={classOpen}
        onCancel={() => setClassOpen(false)}
        onOk={() => classForm.submit()}
      >
        <Form form={classForm} layout="vertical" onFinish={handleCreateClass}>
          <Form.Item
            name="name"
            label="班级名称"
            rules={[{ required: true, message: '请输入班级名称' }]}
          >
            <Input placeholder="例如：1班" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
