import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  Clock,
  GraduationCap,
  Layers,
  UserCheck,
  Users,
  XCircle,
} from 'lucide-react';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, StatCard } from '@/design-system';
import { DashboardSummaryData } from '../dashboard.types';

interface DashboardAcademicTabProps {
  data: DashboardSummaryData;
}

export function DashboardAcademicTab({ data }: DashboardAcademicTabProps) {
  const { present, absent, excused, makeup } = data.todayAttendance;
  const totalMarked = present + absent + excused + makeup;

  const attendanceRate = totalMarked > 0 ? Math.round((present / totalMarked) * 100) : 0;
  const absentRate = totalMarked > 0 ? Math.round((absent / totalMarked) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* 1. هيكل السنتر الأكاديمي والكوادر */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">
            الهيكل الأكاديمي والكوادر التعليمية المسجلة
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="الطلاب المسجلون"
            value={data.totalStudents}
            subtitle={`${data.activeStudents} طالب نشط بحالة اشتراك فعالة`}
            icon={GraduationCap}
            tone="primary"
          />

          <StatCard
            title="هيئة التدريس (المدرسون)"
            value={data.teachersCount}
            subtitle="مدرسون متعاقدون بمجموعات معتمدة"
            icon={UserCheck}
            tone="purple"
          />

          <StatCard
            title="المساعدون والمشرفون"
            value={data.assistantsCount}
            subtitle="مساعدون مسند إليهم مهام ومجموعات"
            icon={Users}
            tone="primary"
          />

          <StatCard
            title="المجموعات الدراسية"
            value={data.groupsCount}
            subtitle="مجموعات نشطة بمواعيد أسبوعية"
            icon={BookOpen}
            tone="success"
          />
        </div>
      </section>

      {/* 2. تحليل حضور وغياب اليوم مع شريط بياني متناسق */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600">
              <CalendarCheck className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">تحليل مؤشرات حضور وغياب اليوم</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                إجمالي الطلاب المرصودة حالتهم حتى اللحظة: {totalMarked} طالب
              </p>
            </div>
          </div>
          <Link to="/attendance">
            <Button variant="outline" size="sm">
              فتح سجل الحضور
              <ArrowLeft className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="space-y-5 pt-4">
          {totalMarked === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              لم يتم رصد حضور الطلاب في حصص اليوم حتى الآن. سيظهر التحليل فور بدء أول حصة ورصد دفتر الحضور.
            </div>
          ) : (
            <>
              {/* مربعات تصنيف الحالات */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3.5 text-center">
                  <div className="flex items-center justify-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-xs font-bold">حاضرون</span>
                  </div>
                  <p className="mt-1 text-2xl font-black text-emerald-600 dark:text-emerald-400">
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
                  <p className="mt-1 text-2xl font-black text-rose-600 dark:text-rose-400">
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
                  <p className="mt-1 text-2xl font-black text-amber-600 dark:text-amber-400">
                    {excused}
                  </p>
                  <span className="text-[11px] text-muted-foreground">
                    مؤهلون لحصص تعويضية
                  </span>
                </div>

                <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-3.5 text-center">
                  <div className="flex items-center justify-center gap-1.5 text-purple-700 dark:text-purple-300">
                    <Layers className="h-4 w-4" />
                    <span className="text-xs font-bold">حضور تعويضي</span>
                  </div>
                  <p className="mt-1 text-2xl font-black text-purple-600 dark:text-purple-400">
                    {makeup}
                  </p>
                  <span className="text-[11px] text-muted-foreground">
                    حضروا كتعويض لحصص سابقة
                  </span>
                </div>
              </div>

              {/* شريط توزيع بياني متعدد الألوان */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold text-muted-foreground">
                  <span>مخطط توزيع الحالات</span>
                  <span className="text-emerald-600 font-extrabold">
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
                    title={`تعويضي: ${makeup}`}
                    className="bg-purple-500 transition-all duration-300"
                    style={{ width: `${(makeup / totalMarked) * 100}%` }}
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

      {/* 3. بطاقات الوصول السريع للأقسام الأكاديمية */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Link
          to="/students"
          className="flex items-center justify-between rounded-xl border border-border bg-card p-4 transition hover:border-primary/50 hover:bg-muted/30"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold">دليل الطلاب والصفوف الدراسية</p>
              <p className="text-xs text-muted-foreground">تعديل الملفات وأرقام الهواتف</p>
            </div>
          </div>
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </Link>

        <Link
          to="/teachers"
          className="flex items-center justify-between rounded-xl border border-border bg-card p-4 transition hover:border-primary/50 hover:bg-muted/30"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-500/10 p-2 text-purple-600">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold">هيئة التدريس والمواد</p>
              <p className="text-xs text-muted-foreground">ملفات المدرسين والمجموعات المسندة</p>
            </div>
          </div>
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </Link>

        <Link
          to="/groups"
          className="flex items-center justify-between rounded-xl border border-border bg-card p-4 transition hover:border-primary/50 hover:bg-muted/30"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold">المجموعات الدراسية والجداول</p>
              <p className="text-xs text-muted-foreground">المواعيد الأسبوعية والأسعار</p>
            </div>
          </div>
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </Link>
      </div>
    </div>
  );
}

