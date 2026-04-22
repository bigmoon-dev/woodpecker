import React, { useRef, useState } from 'react';
import {
  ProTable,
  type ActionType,
  type ProColumns,
} from '@ant-design/pro-components';
import { Button, Modal, Form, Input, message, Popconfirm } from 'antd';
import request from '../../utils/request';

interface BackupRecord {
  fileName: string;
  size: number;
  createdAt: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('zh-CN');
}

export default function DatabaseBackup() {
  const actionRef = useRef<ActionType>();
  const [createOpen, setCreateOpen] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<BackupRecord | null>(null);
  const [form] = Form.useForm();

  const handleCreate = async (values: any) => {
    try {
      await request.post('/admin/backup', values);
      message.success('备份创建成功');
      setCreateOpen(false);
      form.resetFields();
      actionRef.current?.reload();
    } catch {
      message.error('备份创建失败');
    }
  };

  const handleRestore = async (record: BackupRecord) => {
    try {
      await request.post('/admin/backup/restore', { fileName: record.fileName });
      message.success('恢复成功');
      setRestoreTarget(null);
      actionRef.current?.reload();
    } catch {
      message.error('恢复失败');
    }
  };

  const handleDelete = async (fileName: string) => {
    try {
      await request.delete(`/admin/backup/${encodeURIComponent(fileName)}`);
      message.success('删除成功');
      actionRef.current?.reload();
    } catch {
      message.error('删除失败');
    }
  };

  const columns: ProColumns<BackupRecord>[] = [
    { title: '文件名', dataIndex: 'fileName', key: 'fileName', ellipsis: true },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      width: 120,
      render: (_, record) => formatSize(record.size),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 200,
      render: (_, record) => formatDate(record.createdAt),
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_, record) => (
        <>
          <Button type="link" onClick={() => setRestoreTarget(record)}>
            恢复
          </Button>
          <Popconfirm
            title="确认删除此备份？"
            onConfirm={() => handleDelete(record.fileName)}
          >
            <Button type="link" danger>删除</Button>
          </Popconfirm>
        </>
      ),
    },
  ];

  return (
    <>
      <ProTable<BackupRecord>
        rowKey="fileName"
        actionRef={actionRef}
        columns={columns}
        request={async () => {
          const res: any = await request.get('/admin/backup');
          const data = res.data || res || [];
          return { data, total: data.length, success: true };
        }}
        toolBarRender={() => [
          <Button key="create" type="primary" onClick={() => setCreateOpen(true)}>
            创建备份
          </Button>,
        ]}
        search={false}
      />
      <Modal
        title="创建备份"
        open={createOpen}
        onCancel={() => { setCreateOpen(false); form.resetFields(); }}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="name" label="备份名称（可选）">
            <Input placeholder="留空则自动生成" />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title="确认恢复"
        open={!!restoreTarget}
        onCancel={() => setRestoreTarget(null)}
        onOk={() => restoreTarget && handleRestore(restoreTarget)}
        okText="确认恢复"
      >
        <p>确认要恢复备份 <strong>{restoreTarget?.fileName}</strong> 吗？</p>
        <p style={{ color: '#ff4d4f' }}>此操作将覆盖当前数据库，请谨慎操作！</p>
      </Modal>
    </>
  );
}
