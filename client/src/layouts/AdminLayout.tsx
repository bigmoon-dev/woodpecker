import { Outlet } from 'react-router-dom';
import { ProLayout } from '@ant-design/pro-components';
import { useNavigate, useLocation } from 'react-router-dom';
import { clearToken } from '../utils/auth';
import ThemePicker from '../components/ThemePicker';
import { useThemeTokens } from '../themes/ThemeProvider';

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
  const t = useThemeTokens();

  return (
    <>
      <style>{`
        .ant-pro-sider .ant-layout-sider-children {
          background: ${t.siderBg} !important;
        }
        .ant-pro-sider .ant-menu {
          background: transparent !important;
        }
        .ant-pro-sider .ant-menu .ant-menu-item {
          color: rgba(255,255,255,0.75) !important;
          margin: 4px 8px !important;
          border-radius: ${t.tokens.borderRadius}px !important;
          transition: all 0.2s ease !important;
        }
        .ant-pro-sider .ant-menu .ant-menu-item:hover {
          color: #fff !important;
          background: rgba(255,255,255,0.12) !important;
        }
        .ant-pro-sider .ant-menu .ant-menu-item-selected {
          color: #fff !important;
          background: rgba(255,255,255,0.2) !important;
        }
        .ant-pro-sider .ant-layout-sider-children .ant-pro-sider-logo {
          background: transparent !important;
        }
      `}</style>
      <ProLayout
        title="啄木鸟"
        logo={<span style={{ fontSize: 24, marginRight: 8 }}>🪶</span>}
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
          <ThemePicker key="theme" />,
          <a
            key="logout"
            onClick={() => { clearToken(); window.location.href = '/login'; }}
            style={{ fontSize: 14 }}
          >
            退出
          </a>,
        ]}
        contentStyle={{ padding: 24 }}
      >
        <Outlet />
      </ProLayout>
    </>
  );
}
