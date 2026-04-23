import { useState, useMemo } from 'react';
import { Tabs } from 'antd';
import RoleManage from '../admin/RoleManage';
import UserManage from '../admin/UserManage';
import PluginManage from '../admin/PluginManage';
import GradeManage from '../org/GradeManage';
import ClassManage from '../org/ClassManage';
import StudentManage from '../org/StudentManage';
import DatabaseBackup from './DatabaseBackup';
import { hasRole } from '../../utils/auth';

const allTabItems = [
  { key: 'roles', label: '角色管理', children: <RoleManage />, adminOnly: true },
  { key: 'users', label: '用户管理', children: <UserManage />, adminOnly: true },
  { key: 'plugins', label: '插件管理', children: <PluginManage />, adminOnly: true },
  { key: 'grades', label: '年级管理', children: <GradeManage />, adminOnly: true },
  { key: 'classes', label: '班级管理', children: <ClassManage />, adminOnly: true },
  { key: 'students', label: '学生管理', children: <StudentManage />, adminOnly: true },
  { key: 'backup', label: '数据库备份', children: <DatabaseBackup />, adminOnly: false },
];

export default function SettingsPage() {
  const tabItems = useMemo(
    () => allTabItems.filter((t) => t.adminOnly ? hasRole('admin') : true),
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
