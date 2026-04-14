import { useRef, useState } from 'react';
import { ProTable, type ActionType } from '@ant-design/pro-components';
import { Button, Modal, Form, Input, Select, message } from 'antd';
import request from '../../utils/request';

export default function ClassManage() {
  const actionRef = useRef<ActionType>();
  const [open, setOpen] = useState(false);
  const [grades, setGrades] = useState<any[]>([]);
  const [form] = Form.useForm();

  const openCreate = async () => {
    const res: any = await request.get('/admin/grades', { params: { page: 1, pageSize: 100 } });
    setGrades(res.data || res || []);
    setOpen(true);
  };

  const handleCreate = async (values: any) => {
    try {
      await request.post('/admin/classes', values);
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
      await request.delete(`/admin/classes/${id}`);
      message.success('删除成功');
      actionRef.current?.reload();
    } catch {
      message.error('删除失败');
    }
  };

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '年级ID', dataIndex: 'gradeId', key: 'gradeId', ellipsis: true },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Button type="link" danger onClick={() => handleDelete(record.id)}>删除</Button>
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
          const res: any = await request.get('/admin/classes', { params: { page: params.current, pageSize: params.pageSize } });
          return { data: res.data || res, total: res.total, success: true };
        }}
        toolBarRender={() => [
          <Button key="create" type="primary" onClick={openCreate}>新建班级</Button>,
        ]}
        search={false}
      />
      <Modal title="新建班级" open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="gradeId" label="所属年级" rules={[{ required: true }]}>
            <Select options={grades.map((g: any) => ({ label: g.name, value: g.id }))} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
