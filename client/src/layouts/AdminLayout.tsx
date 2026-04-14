import { Outlet } from 'react-router-dom';
import { ProLayout } from '@ant-design/pro-components';
import { useNavigate, useLocation } from 'react-router-dom';
import { clearToken } from '../utils/auth';

const menuRoutes = [
  { path: '/admin/scales', name: '量表管理' },
  { path: '/admin/tasks', name: '任务管理' },
  { path: '/admin/alerts', name: '预警管理' },
  { path: '/admin/results', name: '测评结果' },
  { path: '/admin/roles', name: '角色管理' },
  { path: '/admin/users', name: '用户管理' },
  { path: '/admin/plugins', name: '插件管理' },
  { path: '/admin/grades', name: '年级管理' },
  { path: '/admin/classes', name: '班级管理' },
  { path: '/admin/students', name: '学生管理' },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <ProLayout
      title="啄木鸟心理预警辅助系统"
      layout="mix"
      location={{ pathname: location.pathname }}
      menu={{ request: async () => menuRoutes }}
      menuItemRender={(item, dom) => (
        <span onClick={() => item.path && navigate(item.path)}>{dom}</span>
      )}
      avatarProps={{
        title: '管理员',
        size: 'small',
      }}
      actionsRender={() => [
        <a key="logout" onClick={() => { clearToken(); }}>退出</a>,
      ]}
    >
      <Outlet />
    </ProLayout>
  );
}
