import { useRef, useState } from 'react';
import { ProTable, type ActionType, type ProColumns } from '@ant-design/pro-components';
import { Button, Tag, message, Modal, Form, Input, InputNumber, Select, Switch } from 'antd';
import request from '../../utils/request';

function buildFormItems(schema: Record<string, any>): React.ReactNode[] {
  const properties = schema.properties || {};
  return Object.entries(properties).map(([key, prop]: [string, any]) => {
    const label = prop.title || key;
    switch (prop.type) {
      case 'number':
        return <Form.Item key={key} name={key} label={label}><InputNumber style={{ width: '100%' }} /></Form.Item>;
      case 'boolean':
        return <Form.Item key={key} name={key} label={label} valuePropName="checked"><Switch /></Form.Item>;
      case 'string':
        if (prop.enum) {
          return <Form.Item key={key} name={key} label={label}><Select options={prop.enum.map((v: string) => ({ label: v, value: v }))} /></Form.Item>;
        }
        return <Form.Item key={key} name={key} label={label}><Input /></Form.Item>;
      default:
        return <Form.Item key={key} name={key} label={label}><Input /></Form.Item>;
    }
  });
}

export default function PluginManage() {
  const actionRef = useRef<ActionType>();
  const [settingsModal, setSettingsModal] = useState<{ open: boolean; name: string; schema: Record<string, any> | null; config: Record<string, any> | null }>({
    open: false, name: '', schema: null, config: null,
  });
  const [form] = Form.useForm();

  const togglePlugin = async (name: string, action: 'enable' | 'disable') => {
    try {
      await request.post(`/admin/plugins/${name}/${action}`);
      message.success('操作成功');
      actionRef.current?.reload();
    } catch {
      message.error('操作失败');
    }
  };

  const openSettings = async (name: string) => {
    try {
      const res: any = await request.get(`/admin/plugins/${name}/settings`);
      setSettingsModal({ open: true, name, schema: res.schema, config: res.config });
      form.setFieldsValue(res.config || {});
    } catch {
      message.error('获取配置失败');
    }
  };

  const saveSettings = async () => {
    try {
      const values = await form.validateFields();
      await request.put(`/admin/plugins/${settingsModal.name}/settings`, values);
      message.success('配置已保存');
      setSettingsModal((s) => ({ ...s, open: false }));
    } catch {
      message.error('保存失败');
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
        <>
          <Button type="link" onClick={() => togglePlugin(record.name, record.enabled ? 'disable' : 'enable')}>
            {record.enabled ? '禁用' : '启用'}
          </Button>
          {record.settingsSchema && (
            <Button type="link" onClick={() => openSettings(record.name)}>配置</Button>
          )}
        </>
      ),
    },
  ];

  return (
    <>
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
      <Modal
        title={`插件配置 - ${settingsModal.name}`}
        open={settingsModal.open}
        onOk={saveSettings}
        onCancel={() => setSettingsModal((s) => ({ ...s, open: false }))}
      >
        {settingsModal.schema ? (
          <Form form={form} layout="vertical">
            {buildFormItems(settingsModal.schema)}
          </Form>
        ) : (
          <p>该插件无可配置项</p>
        )}
      </Modal>
    </>
  );
}
