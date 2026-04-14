import { RouteConfig } from './types';
import Login from '../pages/Login';
import StudentLayout from '../layouts/StudentLayout';
import TeacherLayout from '../layouts/TeacherLayout';
import AdminLayout from '../layouts/AdminLayout';
import ScaleList from '../pages/scale/ScaleList';
import ScaleDetail from '../pages/scale/ScaleDetail';
import TaskList from '../pages/task/TaskList';
import Assessment from '../pages/task/Assessment';
import MyResults from '../pages/result/MyResults';
import ClassResults from '../pages/result/ClassResults';
import GradeResults from '../pages/result/GradeResults';
import AlertList from '../pages/alert/AlertList';
import GradeManage from '../pages/org/GradeManage';
import ClassManage from '../pages/org/ClassManage';
import StudentManage from '../pages/org/StudentManage';
import RoleManage from '../pages/admin/RoleManage';
import UserManage from '../pages/admin/UserManage';
import PluginManage from '../pages/admin/PluginManage';
import ConsentPage from '../pages/consent/ConsentPage';
import ScaleLibrary from '../pages/scale/ScaleLibrary';

export const routeConfigs: RouteConfig[] = [
  { path: '/login', component: Login, public: true },
  {
    path: '/student',
    layout: StudentLayout,
    roles: ['student'],
    children: [
      { path: 'tasks', component: TaskList },
      { path: 'assessment/:id', component: Assessment },
      { path: 'results', component: MyResults },
      { path: 'consent', component: ConsentPage },
    ],
  },
  {
    path: '/teacher',
    layout: TeacherLayout,
    roles: ['psychologist', 'teacher'],
    children: [
      { path: 'scales', component: ScaleList },
      { path: 'scales/library', component: ScaleLibrary },
      { path: 'scales/:id', component: ScaleDetail },
      { path: 'tasks', component: TaskList },
      { path: 'assessment/:id', component: Assessment },
      { path: 'results', component: MyResults },
      { path: 'results/class/:classId', component: ClassResults },
      { path: 'results/grade/:gradeId', component: GradeResults },
      { path: 'alerts', component: AlertList },
    ],
  },
  {
    path: '/admin',
    layout: AdminLayout,
    roles: ['admin'],
    children: [
      { path: 'scales', component: ScaleList },
      { path: 'scales/library', component: ScaleLibrary },
      { path: 'scales/:id', component: ScaleDetail },
      { path: 'tasks', component: TaskList },
      { path: 'alerts', component: AlertList },
      { path: 'results', component: MyResults },
      { path: 'results/class/:classId', component: ClassResults },
      { path: 'results/grade/:gradeId', component: GradeResults },
      { path: 'roles', component: RoleManage },
      { path: 'users', component: UserManage },
      { path: 'plugins', component: PluginManage },
      { path: 'grades', component: GradeManage },
      { path: 'classes', component: ClassManage },
      { path: 'students', component: StudentManage },
    ],
  },
];
