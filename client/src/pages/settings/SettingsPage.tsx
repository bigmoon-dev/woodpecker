import { useState, useMemo } from 'react';
import { Tabs } from 'antd';
import RoleManage from '../admin/RoleManage';
import UserManage from '../admin/UserManage';
import PluginManage from '../admin/PluginManage';
import StudentManage from '../org/StudentManage';
import DatabaseBackup from './DatabaseBackup';

const allTabItems = [
  { key: 'roles', label: '角色管理', children: <RoleManage /> },
  { key: 'users', label: '用户管理', children: <UserManage /> },
  { key: 'plugins', label: '插件管理', children: <PluginManage /> },
  { key: 'backup', label: '数据库备份', children: <DatabaseBackup /> },
];

export default function SettingsPage() {
  const tabItems = useMemo(
    () => allTabItems,
    [],
  );
  const [activeKey, setActiveKey] = useState(tabItems[0]?.key ?? 'backup');

  return (
    <Tabs
      activeKey={activeKey}
      onChange={setActiveKey}
      items={tabItems}
      type="card"
    />
  );
}
