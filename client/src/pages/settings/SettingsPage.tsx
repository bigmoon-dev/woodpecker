import { useState } from 'react';
import { Tabs } from 'antd';
import RoleManage from '../admin/RoleManage';
import UserManage from '../admin/UserManage';
import PluginManage from '../admin/PluginManage';
import GradeManage from '../org/GradeManage';
import ClassManage from '../org/ClassManage';
import StudentManage from '../org/StudentManage';
import DatabaseBackup from './DatabaseBackup';

const tabItems = [
  { key: 'roles', label: '角色管理', children: <RoleManage /> },
  { key: 'users', label: '用户管理', children: <UserManage /> },
  { key: 'plugins', label: '插件管理', children: <PluginManage /> },
  { key: 'grades', label: '年级管理', children: <GradeManage /> },
  { key: 'classes', label: '班级管理', children: <ClassManage /> },
  { key: 'students', label: '学生管理', children: <StudentManage /> },
  { key: 'backup', label: '数据库备份', children: <DatabaseBackup /> },
];

export default function SettingsPage() {
  const [activeKey, setActiveKey] = useState('roles');

  return (
    <Tabs
      activeKey={activeKey}
      onChange={setActiveKey}
      items={tabItems}
      type="card"
    />
  );
}
