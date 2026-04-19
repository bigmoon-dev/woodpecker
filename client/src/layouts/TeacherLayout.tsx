import { Outlet } from 'react-router-dom';
import { ProLayout } from '@ant-design/pro-components';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogoutOutlined } from '@ant-design/icons';
import { Dropdown } from 'antd';
import ThemePicker from '../components/ThemePicker';
import { useThemeTokens } from '../themes/ThemeProvider';
import { clearToken } from '../utils/auth';

const menuRoutes = [
  { path: '/teacher/dashboard', name: '数据看板' },
  { path: '/teacher/scales', name: '量表管理',
    routes: [
      { path: '/teacher/scales', name: '自定义量表' },
      { path: '/teacher/scales/library', name: '种子量表' },
    ],
  },
  { path: '/teacher/tasks', name: '测评任务' },
  { path: '/teacher/results', name: '结果查看' },
  { path: '/teacher/alerts', name: '预警管理' },
  { path: '/teacher/followup', name: '随访工作台' },
  { path: '/teacher/interviews', name: '访谈档案',
    routes: [
      { path: '/teacher/interviews', name: '访谈列表' },
      { path: '/teacher/interviews/templates', name: '模板管理' },
      { path: '/teacher/interviews/follow-ups', name: '随访提醒' },
    ],
  },
];

export default function TeacherLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const t = useThemeTokens();

  const handleLogout = () => {
    clearToken();
    navigate('/login');
  };

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
          title: '教师',
          size: 'small',
          render: (_, defaultDom) => (
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'logout',
                    icon: <LogoutOutlined />,
                    label: '退出登录',
                    onClick: handleLogout,
                  },
                ],
              }}
            >
              {defaultDom}
            </Dropdown>
          ),
        }}
        actionsRender={() => [<ThemePicker key="theme" />]}
        contentStyle={{ padding: 24 }}
      >
        <Outlet />
      </ProLayout>
    </>
  );
}
