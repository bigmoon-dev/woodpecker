import { useRef, useState, useEffect } from 'react';
import { ProTable, type ActionType } from '@ant-design/pro-components';
import { Button, Modal, Form, Input, Select, Tag, message } from 'antd';
import request from '../../utils/request';

export default function UserManage() {
  const actionRef = useRef<ActionType>();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [currentId, setCurrentId] = useState('');
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  useEffect(() => {
    request.get('/admin/roles', { params: { pageSize: 100 } }).then((res: any) => {
      const list = res.data || res;
      setRoles(Array.isArray(list) ? list : []);
    });
  }, []);

  const handleCreate = async (values: any) => {
    try {
      await request.post('/admin/users', values);
      message.success('创建成功');
      setOpen(false);
      form.resetFields();
      actionRef.current?.reload();
    } catch {
      message.error('创建失败');
    }
  };

  const handleEdit = async (values: any) => {
    try {
      await request.put(`/admin/users/${currentId}`, values);
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
      await request.delete(`/admin/users/${id}`);
      message.success('删除成功');
      actionRef.current?.reload();
    } catch {
      message.error('删除失败');
    }
  };

  const columns = [
    { title: '用户名', dataIndex: 'username', key: 'username' },
    { title: '显示名', dataIndex: 'displayName', key: 'displayName' },
    {
      title: '角色',
      key: 'roles',
      render: (_: any, record: any) =>
        (record.roles || []).map((r: any) => (
          <Tag key={r.id} color="blue">{r.name}</Tag>
        )),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <>
          <Button type="link" onClick={() => {
            setCurrentId(record.id);
            editForm.setFieldsValue({
              displayName: record.displayName,
              roleIds: (record.roles || []).map((r: any) => r.id),
            });
            setEditOpen(true);
          }}>
            编辑
          </Button>
          <Button type="link" danger onClick={() => handleDelete(record.id)}>删除</Button>
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
          const res: any = await request.get('/admin/users', { params: { page: params.current, pageSize: params.pageSize } });
          return { data: res.data || res, total: res.total, success: true };
        }}
        toolBarRender={() => [
          <Button key="create" type="primary" onClick={() => setOpen(true)}>新建用户</Button>,
        ]}
        search={false}
      />
      <Modal title="新建用户" open={open} onCancel={() => { setOpen(false); form.resetFields(); }} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, min: 8, message: '密码至少8位' }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="displayName" label="显示名" rules={[{ required: true, message: '请输入显示名' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="roleIds" label="角色" rules={[{ required: true, message: '请选择角色' }]}>
            <Select mode="multiple" placeholder="选择角色">
              {roles.map((r) => (
                <Select.Option key={r.id} value={r.id}>{r.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
      <Modal title="编辑用户" open={editOpen} onCancel={() => { setEditOpen(false); editForm.resetFields(); }} onOk={() => editForm.submit()}>
        <Form form={editForm} layout="vertical" onFinish={handleEdit}>
          <Form.Item name="displayName" label="显示名">
            <Input />
          </Form.Item>
          <Form.Item name="roleIds" label="角色">
            <Select mode="multiple" placeholder="选择角色">
              {roles.map((r) => (
                <Select.Option key={r.id} value={r.id}>{r.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
