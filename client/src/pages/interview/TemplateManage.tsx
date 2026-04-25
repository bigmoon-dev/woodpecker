import { useRef, useState } from 'react';
import { ProTable, type ActionType } from '@ant-design/pro-components';
import { Button, Modal, Form, Input, message, Popconfirm, Upload, Space } from 'antd';
import { UploadOutlined, PaperClipOutlined } from '@ant-design/icons';
import request from '../../utils/request';

const ALLOWED_EXT = ['.doc', '.docx', '.xls', '.xlsx', '.pdf'];

function getFileName(filePath: string | null | undefined): string {
  if (!filePath) return '';
  const parts = filePath.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || '';
}

function getFileExt(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx >= 0 ? name.slice(idx).toLowerCase() : '';
}

export default function TemplateManage() {
  const actionRef = useRef<ActionType>();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [currentId, setCurrentId] = useState('');
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();

  const handleUpload = async (templateId: string, file: File) => {
    const ext = getFileExt(file.name);
    if (!ALLOWED_EXT.includes(ext)) {
      message.error('不支持的文件格式，仅支持 .doc .docx .xls .xlsx .pdf');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    try {
      await request.post(`/interviews/templates/${templateId}/file`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      message.success('文件上传成功');
      actionRef.current?.reload();
    } catch {
      message.error('文件上传失败');
    }
  };

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
    { title: '模板名称', dataIndex: 'name', key: 'name', width: 180 },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: '模板文件',
      dataIndex: 'filePath',
      key: 'filePath',
      width: 180,
      render: (filePath: string | null, record: any) => {
        if (!filePath) {
          return (
            <Upload
              showUploadList={false}
              beforeUpload={(file) => { handleUpload(record.id, file); return false; }}
              accept=".doc,.docx,.xls,.xlsx,.pdf"
            >
              <Button type="link" icon={<UploadOutlined />} size="small">上传文件</Button>
            </Upload>
          );
        }
        const name = getFileName(filePath);
        return (
          <Space>
            <a href={`/${filePath}`} target="_blank" rel="noreferrer">
              <PaperClipOutlined /> {name}
            </a>
          </Space>
        );
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (_: any, record: any) =>
        record.createdAt ? new Date(record.createdAt).toLocaleString() : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      render: (_: any, record: any) => (
        <Space>
          <Button
            type="link"
            size="small"
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
          {record.filePath && (
            <Upload
              showUploadList={false}
              beforeUpload={(file) => { handleUpload(record.id, file); return false; }}
              accept=".doc,.docx,.xls,.xlsx,.pdf"
            >
              <Button type="link" size="small">替换文件</Button>
            </Upload>
          )}
          <Popconfirm
            title="确定删除此模板？"
            onConfirm={() => handleDelete(record.id)}
            okText="删除"
            cancelText="取消"
          >
            <Button type="link" danger size="small">删除</Button>
          </Popconfirm>
        </Space>
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
                validator: (_: any, value: string) => {
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
                validator: (_: any, value: string) => {
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
