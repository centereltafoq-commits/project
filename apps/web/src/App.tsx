import * as React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { PERMISSIONS, SystemRole } from '@edu-center/shared';
import { AppLayout } from '@/layout/app-layout';
import { SIDEBAR_NAV_ITEMS } from '@/layout/nav-items';
import { AuthProvider, useAuth } from '@/features/auth/auth-context';
import { CenterSettingsProvider } from '@/features/settings/center-settings-context';
import { LoginPage } from '@/features/auth/login-page';
import { PermissionGuardRoute } from '@/components/permission-guard-route';
import { ForbiddenPage } from '@/components/forbidden-page';

const DashboardPage = React.lazy(() =>
  import('@/features/dashboard/dashboard-page').then((m) => ({ default: m.DashboardPage })),
);
const StudentsPage = React.lazy(() =>
  import('@/features/students/students-page').then((m) => ({ default: m.StudentsPage })),
);
const StudentProfilePage = React.lazy(() =>
  import('@/features/students/student-profile-page').then((m) => ({
    default: m.StudentProfilePage,
  })),
);
const TeachersPage = React.lazy(() =>
  import('@/features/teachers/teachers-page').then((m) => ({ default: m.TeachersPage })),
);
const TeacherProfilePage = React.lazy(() =>
  import('@/features/teachers/teacher-profile-page').then((m) => ({
    default: m.TeacherProfilePage,
  })),
);
const AssistantsPage = React.lazy(() =>
  import('@/features/assistants/assistants-page').then((m) => ({ default: m.AssistantsPage })),
);
const AssistantProfilePage = React.lazy(() =>
  import('@/features/assistants/assistant-profile-page').then((m) => ({
    default: m.AssistantProfilePage,
  })),
);
const GroupsPage = React.lazy(() =>
  import('@/features/groups/groups-page').then((m) => ({ default: m.GroupsPage })),
);
const GroupDetailsPage = React.lazy(() =>
  import('@/features/groups/group-details-page').then((m) => ({ default: m.GroupDetailsPage })),
);
const AttendancePage = React.lazy(() =>
  import('@/features/attendance/attendance-page').then((m) => ({ default: m.AttendancePage })),
);
const FinancePage = React.lazy(() =>
  import('@/features/finance/finance-page').then((m) => ({ default: m.FinancePage })),
);
const ClassroomsPage = React.lazy(() =>
  import('@/features/classrooms/classrooms-page').then((m) => ({ default: m.ClassroomsPage })),
);
const CalendarPage = React.lazy(() =>
  import('@/features/calendar/calendar-page').then((m) => ({ default: m.CalendarPage })),
);
const ReportsPage = React.lazy(() =>
  import('@/features/reports/reports-page').then((m) => ({ default: m.ReportsPage })),
);
const UsersPage = React.lazy(() =>
  import('@/features/users/users-page').then((m) => ({ default: m.UsersPage })),
);
const AuditLogsPage = React.lazy(() =>
  import('@/features/audit-logs/audit-logs-page').then((m) => ({ default: m.AuditLogsPage })),
);
const BackupsPage = React.lazy(() =>
  import('@/features/backups/backups-page').then((m) => ({ default: m.BackupsPage })),
);
const SettingsPage = React.lazy(() =>
  import('@/features/settings/settings-page').then((m) => ({ default: m.SettingsPage })),
);
const WhatsappPage = React.lazy(() =>
  import('@/features/whatsapp/whatsapp-page').then((m) => ({ default: m.WhatsappPage })),
);
const DocsPage = React.lazy(() =>
  import('@/features/docs/docs-page').then((m) => ({ default: m.DocsPage })),
);

function PageLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}

function RoleAwareHome() {
  const { user, hasPermission } = useAuth();
  if (hasPermission(PERMISSIONS.DASHBOARD_VIEW)) {
    return <DashboardPage />;
  }
  const firstNav = SIDEBAR_NAV_ITEMS.find((item) => {
    if (item.to === '/') return false;
    if (item.to === '/settings' && user?.roleCode !== SystemRole.OWNER) return false;
    if (item.requiredRole && user?.roleCode !== item.requiredRole) return false;
    if (item.permission && !hasPermission(item.permission as any)) return false;
    if (item.anyPermissions && !item.anyPermissions.some((p) => hasPermission(p as any))) return false;
    return true;
  });
  if (firstNav) {
    return <Navigate to={firstNav.to} replace />;
  }
  return (
    <ForbiddenPage message="لا تملك أي صلاحيات لعرض أقسام النظام. يرجى مراجعة مسؤول النظام." />
  );
}

export function App() {
  return (
    <AuthProvider>
      <CenterSettingsProvider>
        <BrowserRouter>
          <React.Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/docs" element={<DocsPage />} />
              <Route element={<AppLayout />}>
                <Route index element={<RoleAwareHome />} />
                <Route
                  path="students"
                  element={
                    <PermissionGuardRoute permission={PERMISSIONS.STUDENTS_VIEW}>
                      <StudentsPage />
                    </PermissionGuardRoute>
                  }
                />
                <Route
                  path="students/:id"
                  element={
                    <PermissionGuardRoute permission={PERMISSIONS.STUDENTS_VIEW}>
                      <StudentProfilePage />
                    </PermissionGuardRoute>
                  }
                />
                <Route
                  path="teachers"
                  element={
                    <PermissionGuardRoute
                      anyPermissions={[PERMISSIONS.TEACHERS_VIEW, PERMISSIONS.TEACHERS_VIEW_OWN]}
                    >
                      <TeachersPage />
                    </PermissionGuardRoute>
                  }
                />
                <Route
                  path="teachers/:id"
                  element={
                    <PermissionGuardRoute
                      anyPermissions={[PERMISSIONS.TEACHERS_VIEW, PERMISSIONS.TEACHERS_VIEW_OWN]}
                    >
                      <TeacherProfilePage />
                    </PermissionGuardRoute>
                  }
                />
                <Route
                  path="assistants"
                  element={
                    <PermissionGuardRoute permission={PERMISSIONS.ASSISTANTS_VIEW}>
                      <AssistantsPage />
                    </PermissionGuardRoute>
                  }
                />
                <Route
                  path="assistants/:id"
                  element={
                    <PermissionGuardRoute permission={PERMISSIONS.ASSISTANTS_VIEW}>
                      <AssistantProfilePage />
                    </PermissionGuardRoute>
                  }
                />
                <Route
                  path="groups"
                  element={
                    <PermissionGuardRoute permission={PERMISSIONS.GROUPS_VIEW}>
                      <GroupsPage />
                    </PermissionGuardRoute>
                  }
                />
                <Route
                  path="groups/:id"
                  element={
                    <PermissionGuardRoute permission={PERMISSIONS.GROUPS_VIEW}>
                      <GroupDetailsPage />
                    </PermissionGuardRoute>
                  }
                />
                <Route
                  path="attendance"
                  element={
                    <PermissionGuardRoute
                      anyPermissions={[
                        PERMISSIONS.ATTENDANCE_VIEW,
                        PERMISSIONS.SESSIONS_VIEW,
                      ]}
                    >
                      <AttendancePage />
                    </PermissionGuardRoute>
                  }
                />
                <Route
                  path="finance"
                  element={
                    <PermissionGuardRoute permission={PERMISSIONS.FINANCE_VIEW}>
                      <FinancePage />
                    </PermissionGuardRoute>
                  }
                />
                <Route
                  path="classrooms"
                  element={
                    <PermissionGuardRoute permission={PERMISSIONS.CLASSROOMS_VIEW}>
                      <ClassroomsPage />
                    </PermissionGuardRoute>
                  }
                />
                <Route
                  path="whatsapp"
                  element={
                    <PermissionGuardRoute
                      anyPermissions={[
                        PERMISSIONS.STUDENTS_VIEW,
                        PERMISSIONS.GROUPS_VIEW,
                        PERMISSIONS.ATTENDANCE_VIEW,
                        PERMISSIONS.FINANCE_VIEW,
                      ]}
                    >
                      <WhatsappPage />
                    </PermissionGuardRoute>
                  }
                />
                <Route
                  path="calendar"
                  element={
                    <PermissionGuardRoute permission={PERMISSIONS.CALENDAR_VIEW}>
                      <CalendarPage />
                    </PermissionGuardRoute>
                  }
                />
                <Route
                  path="reports"
                  element={
                    <PermissionGuardRoute permission={PERMISSIONS.REPORTS_VIEW}>
                      <ReportsPage />
                    </PermissionGuardRoute>
                  }
                />
                <Route
                  path="users"
                  element={
                    <PermissionGuardRoute
                      anyPermissions={[PERMISSIONS.USERS_VIEW, PERMISSIONS.ROLES_MANAGE]}
                    >
                      <UsersPage />
                    </PermissionGuardRoute>
                  }
                />
                <Route
                  path="audit-logs"
                  element={
                    <PermissionGuardRoute permission={PERMISSIONS.AUDIT_VIEW}>
                      <AuditLogsPage />
                    </PermissionGuardRoute>
                  }
                />
                <Route
                  path="backups"
                  element={
                    <PermissionGuardRoute permission={PERMISSIONS.BACKUPS_VIEW}>
                      <BackupsPage />
                    </PermissionGuardRoute>
                  }
                />
                <Route
                  path="settings"
                  element={
                    <PermissionGuardRoute
                      requiredRole={SystemRole.OWNER}
                      permission={PERMISSIONS.SETTINGS_MANAGE}
                    >
                      <SettingsPage />
                    </PermissionGuardRoute>
                  }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </React.Suspense>
        </BrowserRouter>
      </CenterSettingsProvider>
    </AuthProvider>
  );
}
