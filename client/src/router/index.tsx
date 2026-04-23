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
import ResultDetail from '../pages/result/ResultDetail';
import ClassResults from '../pages/result/ClassResults';
import GradeResults from '../pages/result/GradeResults';
import GradeManage from '../pages/org/GradeManage';
import ClassManage from '../pages/org/ClassManage';
import StudentManage from '../pages/org/StudentManage';
import RoleManage from '../pages/admin/RoleManage';
import UserManage from '../pages/admin/UserManage';
import PluginManage from '../pages/admin/PluginManage';
import ConsentPage from '../pages/consent/ConsentPage';
import ScaleLibrary from '../pages/scale/ScaleLibrary';
import Dashboard from '../pages/dashboard/Dashboard';
import InterviewList from '../pages/interview/InterviewList';
import InterviewDetail from '../pages/interview/InterviewDetail';
import TemplateManage from '../pages/interview/TemplateManage';
import TimelineView from '../pages/interview/TimelineView';
import FollowupManageNew from '../pages/followup/FollowupManage';
import StudentProfile from '../pages/student/StudentProfile';
import SettingsPage from '../pages/settings/SettingsPage';

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
      { path: 'dashboard', component: Dashboard },
      { path: 'scales', component: ScaleList },
      { path: 'scales/library', component: ScaleLibrary },
      { path: 'scales/:id', component: ScaleDetail },
      { path: 'tasks', component: TaskList },
      { path: 'assessment/:id', component: Assessment },
      { path: 'results', component: MyResults },
      { path: 'results/:id', component: ResultDetail },
      { path: 'results/class/:classId', component: ClassResults },
      { path: 'results/grade/:gradeId', component: GradeResults },
      { path: 'students/:id/profile', component: StudentProfile },
      { path: 'interviews', component: InterviewList },
      { path: 'interviews/:id', component: InterviewDetail },
      { path: 'interviews/templates', component: TemplateManage },
      { path: 'interviews/followup-manage', component: FollowupManageNew },
      { path: 'interviews/timeline/:studentId', component: TimelineView },
      { path: 'settings', component: SettingsPage },
    ],
  },
  {
    path: '/admin',
    layout: AdminLayout,
    roles: ['admin'],
    children: [
      { path: 'dashboard', component: Dashboard },
      { path: 'scales', component: ScaleList },
      { path: 'scales/library', component: ScaleLibrary },
      { path: 'scales/:id', component: ScaleDetail },
      { path: 'tasks', component: TaskList },
      { path: 'students/:id/profile', component: StudentProfile },
      { path: 'results', component: MyResults },
      { path: 'results/:id', component: ResultDetail },
      { path: 'results/class/:classId', component: ClassResults },
      { path: 'results/grade/:gradeId', component: GradeResults },
      { path: 'interviews', component: InterviewList },
      { path: 'interviews/:id', component: InterviewDetail },
      { path: 'interviews/templates', component: TemplateManage },
      { path: 'interviews/followup-manage', component: FollowupManageNew },
      { path: 'interviews/timeline/:studentId', component: TimelineView },
      { path: 'roles', component: RoleManage },
      { path: 'users', component: UserManage },
      { path: 'plugins', component: PluginManage },
      { path: 'grades', component: GradeManage },
      { path: 'classes', component: ClassManage },
      { path: 'students', component: StudentManage },
      { path: 'settings', component: SettingsPage },
    ],
  },
];
