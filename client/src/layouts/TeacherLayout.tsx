import { Outlet } from 'react-router-dom';
import { ProLayout } from '@ant-design/pro-components';
import { useNavigate, useLocation } from 'react-router-dom';

const menuRoutes = [
  { path: '/teacher/scales', name: '量表管理' },
  { path: '/teacher/tasks', name: '测评任务' },
  { path: '/teacher/results', name: '结果查看' },
  { path: '/teacher/alerts', name: '预警管理' },
];

export default function TeacherLayout() {
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
        title: '教师',
        size: 'small',
      }}
    >
      <Outlet />
    </ProLayout>
  );
}
