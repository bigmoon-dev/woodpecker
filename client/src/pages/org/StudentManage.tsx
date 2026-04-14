import { useRef, useState } from 'react';
import { ProTable, type ActionType } from '@ant-design/pro-components';
import { Button, Modal, Form, Input, Select, message } from 'antd';
import request from '../../utils/request';

export default function StudentManage() {
  const actionRef = useRef<ActionType>();
  const [open, setOpen] = useState(false);
  const [classes, setClasses] = useState<any[]>([]);
  const [form] = Form.useForm();

  const openCreate = async () => {
    const res: any = await request.get('/admin/classes', { params: { page: 1, pageSize: 100 } });
    setClasses(res.data || res || []);
    setOpen(true);
  };

  const handleCreate = async (values: any) => {
    try {
      await request.post('/admin/students', values);
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
      await request.delete(`/admin/students/${id}`);
      message.success('删除成功');
      actionRef.current?.reload();
    } catch {
      message.error('删除失败');
    }
  };

  const columns = [
    { title: '姓名', dataIndex: 'name', key: 'name' },
    { title: '学号', dataIndex: 'studentNo', key: 'studentNo' },
    { title: '班级ID', dataIndex: 'classId', key: 'classId', ellipsis: true },
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
          const res: any = await request.get('/admin/students', { params: { page: params.current, pageSize: params.pageSize } });
          return { data: res.data || res, total: res.total, success: true };
        }}
        toolBarRender={() => [
          <Button key="create" type="primary" onClick={openCreate}>新建学生</Button>,
        ]}
        search={false}
      />
      <Modal title="新建学生" open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="studentNo" label="学号" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="classId" label="所属班级" rules={[{ required: true }]}>
            <Select options={classes.map((c: any) => ({ label: c.name, value: c.id }))} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
