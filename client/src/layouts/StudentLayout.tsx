import { Outlet } from 'react-router-dom';
import { ProLayout } from '@ant-design/pro-components';
import { useNavigate, useLocation } from 'react-router-dom';
import ThemePicker from '../components/ThemePicker';

const menuRoutes = [
  { path: '/student/tasks', name: '我的任务' },
  { path: '/student/results', name: '我的结果' },
  { path: '/student/consent', name: '知情同意' },
];

export default function StudentLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <ProLayout
      title="心理健康量表系统"
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
    >
      <Outlet />
    </ProLayout>
  );
}
