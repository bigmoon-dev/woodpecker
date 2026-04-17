import { useRef, useState } from 'react';
import { ProTable, type ActionType } from '@ant-design/pro-components';
import { Button, Modal, Form, Input, message, Popconfirm } from 'antd';
import request from '../../utils/request';

export default function TemplateManage() {
  const actionRef = useRef<ActionType>();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [currentId, setCurrentId] = useState('');
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();

  const handleCreate = async (values: any) => {
    try {
      const payload = {
        ...values,
        fields: values.fields ? JSON.parse(values.fields) : [],
      };
      await request.post('/interviews/templates', payload);
      message.success('创建成功');
      setCreateOpen(false);
      createForm.resetFields();
      actionRef.current?.reload();
    } catch {
      message.error('创建失败');
    }
  };

  const handleEdit = async (values: any) => {
    try {
      const payload = {
        ...values,
        fields: values.fields ? JSON.parse(values.fields) : [],
      };
      await request.put(`/interviews/templates/${currentId}`, payload);
      message.success('更新成功');
      setEditOpen(false);
      editForm.resetFields();
      actionRef.current?.reload();
    } catch {
      message.error('更新失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await request.delete(`/interviews/templates/${id}`);
      message.success('删除成功');
      actionRef.current?.reload();
    } catch {
      message.error('删除失败');
    }
  };

  const columns = [
    { title: '模板名称', dataIndex: 'name', key: 'name' },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (_: any, record: any) =>
        record.createdAt ? new Date(record.createdAt).toLocaleString() : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_: any, record: any) => (
        <>
          <Button
            type="link"
            onClick={() => {
              setCurrentId(record.id);
              editForm.setFieldsValue({
                name: record.name,
                description: record.description,
                fields: record.fields ? JSON.stringify(record.fields, null, 2) : '',
              });
              setEditOpen(true);
            }}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除此模板？"
            onConfirm={() => handleDelete(record.id)}
            okText="删除"
            cancelText="取消"
          >
            <Button type="link" danger>删除</Button>
          </Popconfirm>
        </>
      ),
    },
  ];

  return (
    <>
      <ProTable
        rowKey="id"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const res: any = await request.get('/interviews/templates/all', {
            params: { page: params.current, pageSize: params.pageSize },
          });
          return { data: res.data || res, total: res.total, success: true };
        }}
        toolBarRender={() => [
          <Button key="create" type="primary" onClick={() => setCreateOpen(true)}>
            新建模板
          </Button>,
        ]}
        search={false}
      />
      <Modal
        title="新建模板"
        open={createOpen}
        onCancel={() => { setCreateOpen(false); createForm.resetFields(); }}
        onOk={() => createForm.submit()}
        width={600}
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="name" label="模板名称" rules={[{ required: true, message: '请输入模板名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item
            name="fields"
            label="字段定义(JSON)"
            rules={[
              {
                validator: (_, value) => {
                  if (!value) return Promise.resolve();
                  try {
                    JSON.parse(value);
                    return Promise.resolve();
                  } catch {
                    return Promise.reject('请输入合法的JSON');
                  }
                },
              },
            ]}
          >
            <Input.TextArea rows={6} placeholder='[{"key": "summary", "label": "总结"}]' />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title="编辑模板"
        open={editOpen}
        onCancel={() => { setEditOpen(false); editForm.resetFields(); }}
        onOk={() => editForm.submit()}
        width={600}
      >
        <Form form={editForm} layout="vertical" onFinish={handleEdit}>
          <Form.Item name="name" label="模板名称" rules={[{ required: true, message: '请输入模板名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item
            name="fields"
            label="字段定义(JSON)"
            rules={[
              {
                validator: (_, value) => {
                  if (!value) return Promise.resolve();
                  try {
                    JSON.parse(value);
                    return Promise.resolve();
                  } catch {
                    return Promise.reject('请输入合法的JSON');
                  }
                },
              },
            ]}
          >
            <Input.TextArea rows={6} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
