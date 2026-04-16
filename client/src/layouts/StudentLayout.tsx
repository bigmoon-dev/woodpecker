import { Outlet } from 'react-router-dom';
import { ProLayout } from '@ant-design/pro-components';
import { useNavigate, useLocation } from 'react-router-dom';
import ThemePicker from '../components/ThemePicker';
import { useThemeTokens } from '../themes/ThemeProvider';

const menuRoutes = [
  { path: '/student/tasks', name: '我的任务' },
  { path: '/student/results', name: '我的结果' },
  { path: '/student/consent', name: '知情同意' },
];

export default function StudentLayout() {
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
          title: '学生',
          size: 'small',
        }}
        actionsRender={() => [<ThemePicker key="theme" />]}
        contentStyle={{ padding: 24 }}
      >
        <Outlet />
      </ProLayout>
    </>
  );
}
