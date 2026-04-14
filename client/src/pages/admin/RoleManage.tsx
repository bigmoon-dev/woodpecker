import { useRef, useState, useEffect } from 'react';
import { ProTable, type ActionType } from '@ant-design/pro-components';
import { Button, Modal, Form, Input, Transfer, message } from 'antd';
import request from '../../utils/request';

export default function RoleManage() {
  const actionRef = useRef<ActionType>();
  const [open, setOpen] = useState(false);
  const [permOpen, setPermOpen] = useState(false);
  const [allPermissions, setAllPermissions] = useState<any[]>([]);
  const [targetKeys, setTargetKeys] = useState<string[]>([]);
  const [currentRoleId, setCurrentRoleId] = useState('');
  const [form] = Form.useForm();

  useEffect(() => {
    request.get('/admin/permissions', { params: { page: 1, pageSize: 100 } })
      .then((res: any) => setAllPermissions(res.data || res || []));
  }, []);

  const handleCreate = async (values: any) => {
    try {
      await request.post('/admin/roles', values);
      message.success('创建成功');
      setOpen(false);
      form.resetFields();
      actionRef.current?.reload();
    } catch {
      message.error('创建失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await request.delete(`/admin/roles/${id}`);
      message.success('删除成功');
      actionRef.current?.reload();
    } catch {
      message.error('删除失败');
    }
  };

  const openPermAssign = async (roleId: string) => {
    setCurrentRoleId(roleId);
    const res: any = await request.get('/admin/roles', { params: { page: 1, pageSize: 100 } });
    const roles = res.data || res || [];
    const role = roles.find((r: any) => r.id === roleId);
    setTargetKeys(role?.permissions?.map((p: any) => p.id) || []);
    setPermOpen(true);
  };

  const savePermissions = async () => {
    try {
      await request.put(`/admin/roles/${currentRoleId}/permissions`, { permissionIds: targetKeys });
      message.success('权限更新成功');
      setPermOpen(false);
      actionRef.current?.reload();
    } catch {
      message.error('权限更新失败');
    }
  };

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '描述', dataIndex: 'description', key: 'description' },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <>
          <Button type="link" onClick={() => openPermAssign(record.id)}>权限</Button>
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
          const res: any = await request.get('/admin/roles', { params: { page: params.current, pageSize: params.pageSize } });
          return { data: res.data || res, total: res.total, success: true };
        }}
        toolBarRender={() => [
          <Button key="create" type="primary" onClick={() => setOpen(true)}>新建角色</Button>,
        ]}
        search={false}
      />
      <Modal title="新建角色" open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
      <Modal title="分配权限" open={permOpen} onCancel={() => setPermOpen(false)} onOk={savePermissions} width={600}>
        <Transfer
          dataSource={allPermissions.map((p: any) => ({ key: p.id, title: p.code || p.name }))}
          targetKeys={targetKeys}
          onChange={(keys) => setTargetKeys(keys as string[])}
          render={(item) => item.title!}
          rowKey={(item) => item.key}
        />
      </Modal>
    </>
  );
}
