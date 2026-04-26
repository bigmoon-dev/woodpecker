import { RouteConfig } from './types';
import Login from '../pages/Login';
import StudentLayout from '../layouts/StudentLayout';
import AdminLayout from '../layouts/AdminLayout';
import ScaleList from '../pages/scale/ScaleList';
import ScaleDetail from '../pages/scale/ScaleDetail';
import TaskList from '../pages/task/TaskList';
import Assessment from '../pages/task/Assessment';
import MyResults from '../pages/result/MyResults';
import ResultDetail from '../pages/result/ResultDetail';
import ClassResults from '../pages/result/ClassResults';
import GradeResults from '../pages/result/GradeResults';
import GradeClassManage from '../pages/org/GradeClassManage';
import StudentManage from '../pages/org/StudentManage';
import RoleManage from '../pages/admin/RoleManage';
import UserManage from '../pages/admin/UserManage';
import PluginManage from '../pages/admin/PluginManage';
import AuditLogPage from '../pages/admin/AuditLogPage';
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
import HelpPage from '../pages/help/HelpPage';

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
    path: '/admin',
    layout: AdminLayout,
    roles: ['admin', 'psychologist', 'teacher'],
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
      { path: 'audit-logs', component: AuditLogPage },
      { path: 'grades', component: GradeClassManage },
      { path: 'students', component: StudentManage },
      { path: 'settings', component: SettingsPage },
      { path: 'help', component: HelpPage },
    ],
  },
];
