import * as React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { PERMISSIONS } from '@edu-center/shared';
import { AppLayout } from '@/layout/app-layout';
import { AuthProvider, useAuth } from '@/features/auth/auth-context';
import { LoginPage } from '@/features/auth/login-page';

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
const BookingsPage = React.lazy(() =>
  import('@/features/bookings/bookings-page').then((m) => ({ default: m.BookingsPage })),
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

function PageLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}

function RoleAwareHome() {
  const { hasPermission } = useAuth();
  if (hasPermission(PERMISSIONS.DASHBOARD_VIEW)) {
    return <DashboardPage />;
  }
  if (hasPermission(PERMISSIONS.ATTENDANCE_VIEW)) {
    return <Navigate to="/attendance" replace />;
  }
  if (hasPermission(PERMISSIONS.CALENDAR_VIEW)) {
    return <Navigate to="/calendar" replace />;
  }
  return <Navigate to="/bookings" replace />;
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <React.Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<AppLayout />}>
              <Route index element={<RoleAwareHome />} />
              <Route path="students" element={<StudentsPage />} />
              <Route path="students/:id" element={<StudentProfilePage />} />
              <Route path="teachers" element={<TeachersPage />} />
              <Route path="teachers/:id" element={<TeacherProfilePage />} />
              <Route path="assistants" element={<AssistantsPage />} />
              <Route path="assistants/:id" element={<AssistantProfilePage />} />
              <Route path="groups" element={<GroupsPage />} />
              <Route path="groups/:id" element={<GroupDetailsPage />} />
              <Route path="attendance" element={<AttendancePage />} />
              <Route path="finance" element={<FinancePage />} />
              <Route path="bookings" element={<BookingsPage />} />
              <Route path="classrooms" element={<ClassroomsPage />} />
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="audit-logs" element={<AuditLogsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </React.Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
