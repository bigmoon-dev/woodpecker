import { Outlet } from 'react-router-dom';
import { ProLayout } from '@ant-design/pro-components';
import { useNavigate, useLocation } from 'react-router-dom';
import { clearToken } from '../utils/auth';
import ThemePicker from '../components/ThemePicker';
import { useThemeTokens } from '../themes/ThemeProvider';

const displayName = (() => {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.displayName || user.username || '管理员';
  } catch { return '管理员'; }
})();

const menuRoutes = [
  { path: '/admin/dashboard', name: '数据看板' },
  {
    path: '/admin/scales',
    name: '量表管理',
    routes: [
      { path: '/admin/scales', name: '自定义量表' },
      { path: '/admin/scales/library', name: '种子量表' },
    ],
  },
  { path: '/admin/tasks', name: '任务管理' },
  { path: '/admin/results', name: '测评结果' },
  { path: '/admin/interviews', name: '访谈管理',
    routes: [
      { path: '/admin/interviews', name: '访谈列表' },
      { path: '/admin/interviews/templates', name: '模板管理' },
      { path: '/admin/interviews/followup-manage', name: '随访管理' },
    ],
  },
  { path: '/admin/settings', name: '系统设置' },
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
        .ant-pro-sider .ant-menu .ant-menu-item,
        .ant-pro-sider .ant-menu .ant-menu-submenu-title {
          color: rgba(255,255,255,0.75) !important;
          margin: 4px 8px !important;
          border-radius: ${t.tokens.borderRadius}px !important;
          transition: all 0.2s ease !important;
        }
        .ant-pro-sider .ant-menu .ant-menu-item:hover,
        .ant-pro-sider .ant-menu .ant-menu-submenu-title:hover {
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
          title: displayName,
          size: 'small',
        }}
        actionsRender={() => [
          <ThemePicker key="theme" />,
          <a
            key="logout"
            href="/login"
            onClick={(e) => { e.preventDefault(); clearToken(); window.location.replace('/login'); }}
            style={{ fontSize: 14, cursor: 'pointer' }}
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
