import { useRef, useState } from 'react';
import { ProTable, type ActionType, type ProColumns } from '@ant-design/pro-components';
import { Button, Tag, message } from 'antd';
import request from '../../utils/request';

export default function PluginManage() {
  const actionRef = useRef<ActionType>();

  const togglePlugin = async (name: string, action: 'enable' | 'disable') => {
    try {
      await request.post(`/admin/plugins/${name}/${action}`);
      message.success('操作成功');
      actionRef.current?.reload();
    } catch {
      message.error('操作失败');
    }
  };

  const columns: ProColumns[] = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '版本', dataIndex: 'version', key: 'version' },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (_: any, record: any) => <Tag color={record.enabled ? 'green' : 'default'}>{record.enabled ? '启用' : '禁用'}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Button
          type="link"
          onClick={() => togglePlugin(record.name, record.enabled ? 'disable' : 'enable')}
        >
          {record.enabled ? '禁用' : '启用'}
        </Button>
      ),
    },
  ];

  return (
    <ProTable
      rowKey="name"
      actionRef={actionRef}
      columns={columns}
      request={async () => {
        const res: any = await request.get('/admin/plugins');
        const data = res.loaded || res.data || [];
        return { data, total: data.length, success: true };
      }}
      search={false}
    />
  );
}
