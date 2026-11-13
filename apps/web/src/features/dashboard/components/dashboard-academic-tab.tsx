import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  Clock,
  GraduationCap,
  UserCheck,
  Users,
  XCircle,
} from 'lucide-react';
import { PERMISSIONS } from '@edu-center/shared';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/design-system';
import { useAuth } from '@/features/auth/auth-context';
import { DashboardSummaryData } from '../dashboard.types';

interface DashboardAcademicTabProps {
  data: DashboardSummaryData;
}

export function DashboardAcademicTab({ data }: DashboardAcademicTabProps) {
  const { hasPermission } = useAuth();
  const canAccessAttendance =
    hasPermission(PERMISSIONS.ATTENDANCE_VIEW) ||
    hasPermission(PERMISSIONS.SESSIONS_VIEW);
  const canViewStudents = hasPermission(PERMISSIONS.STUDENTS_VIEW);
  const canViewTeachers =
    hasPermission(PERMISSIONS.TEACHERS_VIEW) || hasPermission(PERMISSIONS.TEACHERS_VIEW_OWN);
  const canViewAssistants = hasPermission(PERMISSIONS.ASSISTANTS_VIEW);
  const canViewGroups = hasPermission(PERMISSIONS.GROUPS_VIEW);

  const { present, absent, excused } = data.todayAttendance;
  const totalMarked = present + absent + excused;

  const attendanceRate = totalMarked > 0 ? Math.round((present / totalMarked) * 100) : 0;
  const absentRate = totalMarked > 0 ? Math.round((absent / totalMarked) * 100) : 0;
  const activeStudentRate =
    data.totalStudents > 0 ? Math.round((data.activeStudents / data.totalStudents) * 100) : 0;

  const structureCards = [
    {
      title: 'الطلاب المسجلون',
      value: data.totalStudents,
      subtitle: `${data.activeStudents} نشط حالياً (${activeStudentRate}%)`,
      icon: GraduationCap,
      iconClass: 'bg-primary/10 text-primary',
      to: canViewStudents ? '/students' : null,
    },
    {
      title: 'هيئة التدريس',
      value: data.teachersCount,
      subtitle: 'مدرسون متعاقدون بمجموعات',
      icon: UserCheck,
      iconClass: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
      to: canViewTeachers ? '/teachers' : null,
    },
    {
      title: 'المساعدون',
      value: data.assistantsCount,
      subtitle: 'مساعدو الحصص والمتابعة',
      icon: Users,
      iconClass: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
      to: canViewAssistants ? '/assistants' : null,
    },
    {
      title: 'المجموعات الدراسية',
      value: data.groupsCount,
      subtitle: `${data.scheduledGroupsCount ?? 0} بجدول أسبوعي`,
      icon: BookOpen,
      iconClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      to: canViewGroups ? '/groups' : null,
    },
  ];

  return (
    <div className="space-y-5">
      {/* 1. هيكل السنتر الأكاديمي والكوادر (بطاقات مباشرة بدون تكرار روابط أسفلها) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {structureCards.map((item) => {
          const Icon = item.icon;
          const cardBody = (
            <Card className="h-full p-4 transition-all hover:border-primary/40 hover:shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-xs font-semibold text-muted-foreground">{item.title}</span>
                  <p className="mt-1 text-2xl font-black text-foreground tabular-nums">
                    {item.value}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{item.subtitle}</p>
                </div>
                <div className={`rounded-xl p-2.5 ${item.iconClass}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              {item.to && (
                <div className="mt-3 flex items-center justify-end gap-1 text-[11px] font-bold text-primary">
                  <span>فتح القسم</span>
                  <ArrowLeft className="h-3 w-3" />
                </div>
              )}
            </Card>
          );

          return item.to ? (
            <Link key={item.title} to={item.to} className="block h-full">
              {cardBody}
            </Link>
          ) : (
            <div key={item.title}>{cardBody}</div>
          );
        })}
      </div>

      {/* 2. تحليل حضور وغياب اليوم */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400">
              <CalendarCheck className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">تحليل التزام الحضور والغياب اليوم</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                إجمالي الطلاب المرصودة حالتهم حتى الآن: {totalMarked} طالب
              </p>
            </div>
          </div>
          {canAccessAttendance && (
            <Link to="/attendance">
              <Button variant="outline" size="sm">
                فتح سجل الحضور
                <ArrowLeft className="h-3.5 w-3.5" />
              </Button>
            </Link>
          )}
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          {totalMarked === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              لم يتم رصد حضور الطلاب في حصص اليوم حتى الآن. سيظهر التحليل فور رصد أول حصة.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3.5 text-center">
                  <div className="flex items-center justify-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-xs font-bold">حاضرون</span>
                  </div>
                  <p className="mt-1 text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {present}
                  </p>
                  <span className="text-[11px] text-muted-foreground">
                    {attendanceRate}% من إجمالي المرصود
                  </span>
                </div>

                <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3.5 text-center">
                  <div className="flex items-center justify-center gap-1.5 text-rose-700 dark:text-rose-300">
                    <XCircle className="h-4 w-4" />
                    <span className="text-xs font-bold">غائبون</span>
                  </div>
                  <p className="mt-1 text-2xl font-black text-rose-600 dark:text-rose-400 tabular-nums">
                    {absent}
                  </p>
                  <span className="text-[11px] text-muted-foreground">
                    {absentRate}% بحاجة لمتابعة
                  </span>
                </div>

                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5 text-center">
                  <div className="flex items-center justify-center gap-1.5 text-amber-700 dark:text-amber-300">
                    <Clock className="h-4 w-4" />
                    <span className="text-xs font-bold">غياب بعذر</span>
                  </div>
                  <p className="mt-1 text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums">
                    {excused}
                  </p>
                  <span className="text-[11px] text-muted-foreground">بعذر مقبول وموثق</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold text-muted-foreground">
                  <span>مخطط توزيع الحالات</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">
                    نسبة الالتزام بالحضور: {attendanceRate}%
                  </span>
                </div>
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    title={`حاضر: ${present}`}
                    className="bg-emerald-500 transition-all duration-300"
                    style={{ width: `${(present / totalMarked) * 100}%` }}
                  />
                  <div
                    title={`بعذر: ${excused}`}
                    className="bg-amber-400 transition-all duration-300"
                    style={{ width: `${(excused / totalMarked) * 100}%` }}
                  />
                  <div
                    title={`غائب: ${absent}`}
                    className="bg-rose-500 transition-all duration-300"
                    style={{ width: `${(absent / totalMarked) * 100}%` }}
                  />
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
