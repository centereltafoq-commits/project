import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Layers,
  Phone,
  Search,
  Users,
  X,
} from 'lucide-react';
import { PERMISSIONS } from '@edu-center/shared';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@/design-system';
import { useAuth } from '@/features/auth/auth-context';
import { formatCurrency, formatYearMonthAr } from '@/lib/formatters';
import {
  DashboardSessionProgressStudentItem,
  DashboardSessionProgressSummary,
  DashboardSummaryData,
} from '../dashboard.types';

interface DashboardSessionProgressCardProps {
  data: DashboardSummaryData;
}

type DrilldownFilter =
  | { kind: 'ALL_NEAR_LAST' }
  | { kind: 'ALL_LAST' }
  | { kind: 'TRACK_STEP'; targetSessions: number; stepNumber: number; label: string }
  | null;

const EMPTY_PROGRESS: DashboardSessionProgressSummary = {
  totalTrackedEnrollments: 0,
  nearLastTotalCount: 0,
  lastOrCompletedTotalCount: 0,
  inProgressTotalCount: 0,
  notStartedTotalCount: 0,
  tracks: [],
  students: [],
};

function getGridColsClass(stepsCount: number): string {
  if (stepsCount <= 4) return 'grid-cols-2 sm:grid-cols-4';
  if (stepsCount <= 6) return 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6';
  return 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-8';
}

function getStatusBadge(status: DashboardSessionProgressStudentItem['status']) {
  switch (status) {
    case 'LAST_OR_DONE':
      return <Badge variant="danger" className="text-[10px]">الحصة الأخيرة</Badge>;
    case 'NEAR_LAST':
      return <Badge variant="warning" className="text-[10px]">قرب من الأخيرة</Badge>;
    case 'IN_PROGRESS':
      return <Badge variant="info" className="text-[10px]">قيد الحضور</Badge>;
    default:
      return <Badge variant="neutral" className="text-[10px]">لم يحضر بعد</Badge>;
  }
}

export function DashboardSessionProgressCard({ data }: DashboardSessionProgressCardProps) {
  const { hasPermission } = useAuth();
  const canViewFinance = hasPermission(PERMISSIONS.FINANCE_VIEW);
  const canViewStudents = hasPermission(PERMISSIONS.STUDENTS_VIEW);
  const canViewGroups = hasPermission(PERMISSIONS.GROUPS_VIEW);
  const canAccessAttendance =
    hasPermission(PERMISSIONS.ATTENDANCE_VIEW) || hasPermission(PERMISSIONS.SESSIONS_VIEW);

  const canShowSection = canAccessAttendance || canViewStudents || canViewGroups;
  const progress = data.monthlySessionProgress ?? EMPTY_PROGRESS;

  const [selectedTrackTarget, setSelectedTrackTarget] = React.useState<number | 'ALL'>('ALL');
  const [drilldown, setDrilldown] = React.useState<DrilldownFilter>(null);
  const [searchTerm, setSearchTerm] = React.useState('');

  React.useEffect(() => {
    setSelectedTrackTarget('ALL');
    setDrilldown(null);
    setSearchTerm('');
  }, [data.yearMonth]);

  const visibleTracks = React.useMemo(() => {
    if (selectedTrackTarget === 'ALL') return progress.tracks;
    return progress.tracks.filter((t) => t.targetSessions === selectedTrackTarget);
  }, [progress.tracks, selectedTrackTarget]);

  const filteredStudents = React.useMemo(() => {
    if (!drilldown) return [];
    const query = searchTerm.trim().toLowerCase();

    return progress.students.filter((item) => {
      if (drilldown.kind === 'ALL_NEAR_LAST' && item.status !== 'NEAR_LAST') {
        return false;
      }
      if (drilldown.kind === 'ALL_LAST' && item.status !== 'LAST_OR_DONE') {
        return false;
      }
      if (
        drilldown.kind === 'TRACK_STEP' &&
        (item.targetSessions !== drilldown.targetSessions || item.stepNumber !== drilldown.stepNumber)
      ) {
        return false;
      }

      if (!query) return true;
      return (
        item.studentName.toLowerCase().includes(query) ||
        item.studentCode.toLowerCase().includes(query) ||
        item.groupName.toLowerCase().includes(query) ||
        item.subject.toLowerCase().includes(query)
      );
    });
  }, [drilldown, progress.students, searchTerm]);

  const drilldownTitle = React.useMemo(() => {
    if (!drilldown) return '';
    if (drilldown.kind === 'ALL_NEAR_LAST') {
      return 'الطلاب في الحصة قبل الأخيرة (قربوا من النهاية)';
    }
    if (drilldown.kind === 'ALL_LAST') {
      return 'الطلاب في الحصة الأخيرة (مكتملون / للتجديد)';
    }
    return `نظام ${drilldown.targetSessions} حصص — ${drilldown.label}`;
  }, [drilldown]);

  const toggleDrilldown = (next: NonNullable<DrilldownFilter>) => {
    setSearchTerm('');
    setDrilldown((prev) => {
      if (!prev) return next;
      if (prev.kind === next.kind) {
        if (prev.kind !== 'TRACK_STEP') return null;
        if (
          next.kind === 'TRACK_STEP' &&
          prev.targetSessions === next.targetSessions &&
          prev.stepNumber === next.stepNumber
        ) {
          return null;
        }
      }
      return next;
    });
  };

  if (!canShowSection) return null;

  return (
    <Card className="xl:col-span-12">
      <CardHeader className="space-y-3 border-b border-border pb-3.5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="rounded-lg bg-amber-500/15 p-2 text-amber-600 dark:text-amber-400">
              <Clock3 className="h-4.5 w-4.5" />
            </div>
            <div>
              <CardTitle className="text-base">
                متابعة الحصص والاقتراب من الحصة الأخيرة ({formatYearMonthAr(data.yearMonth)})
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                توزيع اشتراكات الشهر حسب حصص المجموعة المنفذة للطالب (اضغط على أي مرحلة لعرض أسماء الطلاب)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => toggleDrilldown({ kind: 'ALL_NEAR_LAST' })}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-all ${
                drilldown?.kind === 'ALL_NEAR_LAST'
                  ? 'border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-2 ring-amber-500/30'
                  : 'border-amber-500/30 bg-amber-500/5 text-amber-700 hover:bg-amber-500/10 dark:text-amber-300'
              }`}
            >
              <AlertCircle className="h-3.5 w-3.5" />
              <span>قبل الأخيرة (قرب يخلص):</span>
              <span className="rounded-full bg-amber-500/20 px-1.5 font-mono text-[11px]">
                {progress.nearLastTotalCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => toggleDrilldown({ kind: 'ALL_LAST' })}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-all ${
                drilldown?.kind === 'ALL_LAST'
                  ? 'border-rose-500 bg-rose-500/15 text-rose-700 dark:text-rose-300 ring-2 ring-rose-500/30'
                  : 'border-rose-500/30 bg-rose-500/5 text-rose-700 hover:bg-rose-500/10 dark:text-rose-300'
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>الحصة الأخيرة:</span>
              <span className="rounded-full bg-rose-500/20 px-1.5 font-mono text-[11px]">
                {progress.lastOrCompletedTotalCount}
              </span>
            </button>

            <Badge variant="neutral" className="px-2.5 py-1 text-xs">
              <Users className="ml-1 h-3 w-3" />
              {progress.totalTrackedEnrollments} اشتراك نشط
            </Badge>
          </div>
        </div>

        {progress.tracks.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedTrackTarget('ALL')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
                selectedTrackTarget === 'ALL'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <span>كل الأنظمة</span>
              <span className="rounded-full bg-background/20 px-1.5 text-[10px] font-mono">
                {progress.tracks.length}
              </span>
            </button>
            {progress.tracks.map((track) => {
              const active = selectedTrackTarget === track.targetSessions;
              return (
                <button
                  key={track.targetSessions}
                  type="button"
                  onClick={() => setSelectedTrackTarget(track.targetSessions)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
                    active
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <span>نظام {track.targetSessions} حصص</span>
                  <span
                    className={`rounded-full px-1.5 text-[10px] font-mono ${
                      active ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-background'
                    }`}
                  >
                    {track.totalEnrollments}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4 pt-4">
        {progress.tracks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-5 text-center space-y-2">
            <p className="text-sm font-bold text-foreground">
              لا توجد اشتراكات نشطة مسجلة لهذا الشهر بعد
            </p>
            <p className="text-xs text-muted-foreground">
              بمجرد تسجيل اشتراكات الطلاب ورصد حضور الحصص، سيظهر هنا تلقائياً عدد الطلاب في كل حصة (مثل الثالثة والرابعة لنظام 4 حصص).
            </p>
            <div className="pt-1 flex justify-center gap-2">
              {canViewGroups && (
                <Link to="/groups">
                  <Button variant="outline" size="sm">
                    إدارة المجموعات
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              )}
              {canAccessAttendance && (
                <Link to="/attendance">
                  <Button variant="primary" size="sm">
                    دفتر التحضير
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {visibleTracks.map((track) => (
              <div
                key={track.targetSessions}
                className="rounded-xl border border-border/80 bg-muted/15 p-3.5 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Layers className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-foreground">
                        نظام {track.targetSessions} حصص بالشهر
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        إجمالي الاشتراكات: <strong className="text-foreground">{track.totalEnrollments}</strong>
                        {track.notStartedCount > 0 && ` • لم يحضر بعد: ${track.notStartedCount}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    {track.notStartedCount > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          toggleDrilldown({
                            kind: 'TRACK_STEP',
                            targetSessions: track.targetSessions,
                            stepNumber: 0,
                            label: 'لم يحضر بعد (0)',
                          })
                        }
                        className={`rounded-md border px-2 py-0.5 font-semibold transition-colors ${
                          drilldown?.kind === 'TRACK_STEP' &&
                          drilldown.targetSessions === track.targetSessions &&
                          drilldown.stepNumber === 0
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-card text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        لم يحضر بعد: {track.notStartedCount}
                      </button>
                    )}
                    <Badge variant="warning" className="text-[10px]">
                      قبل الأخيرة: {track.nearLastCount}
                    </Badge>
                    <Badge variant="danger" className="text-[10px]">
                      الأخيرة: {track.lastOrCompletedCount}
                    </Badge>
                  </div>
                </div>

                <div className={`grid gap-2.5 ${getGridColsClass(track.steps.length)}`}>
                  {track.steps.map((step) => {
                    const isSelected =
                      drilldown?.kind === 'TRACK_STEP' &&
                      drilldown.targetSessions === track.targetSessions &&
                      drilldown.stepNumber === step.stepNumber;

                    const baseStyle = step.isLast
                      ? 'border-rose-500/35 bg-rose-500/[0.06] hover:border-rose-500/60'
                      : step.isNearLast
                        ? 'border-amber-500/35 bg-amber-500/[0.06] hover:border-amber-500/60'
                        : 'border-border bg-card hover:border-primary/40';

                    const countColor = step.isLast
                      ? 'text-rose-600 dark:text-rose-400'
                      : step.isNearLast
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-foreground';

                    return (
                      <button
                        key={step.stepNumber}
                        type="button"
                        onClick={() =>
                          toggleDrilldown({
                            kind: 'TRACK_STEP',
                            targetSessions: track.targetSessions,
                            stepNumber: step.stepNumber,
                            label: step.label,
                          })
                        }
                        className={`flex flex-col justify-between rounded-xl border p-3 text-right transition-all ${baseStyle} ${
                          isSelected ? 'ring-2 ring-primary shadow-sm' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 w-full">
                          <span className="text-xs font-bold text-foreground">
                            الحصة {step.stepNumber}
                          </span>
                          {step.isLast ? (
                            <Badge variant="danger" className="px-1.5 py-0 text-[9px]">
                              الأخيرة
                            </Badge>
                          ) : step.isNearLast ? (
                            <Badge variant="warning" className="px-1.5 py-0 text-[9px]">
                              قبل الأخيرة
                            </Badge>
                          ) : null}
                        </div>

                        <div className="mt-2 flex items-baseline gap-1">
                          <span className={`text-2xl font-black tabular-nums ${countColor}`}>
                            {step.studentsCount}
                          </span>
                          <span className="text-[11px] font-semibold text-muted-foreground">
                            طالب
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {drilldown && (
          <div className="rounded-xl border border-primary/25 bg-card p-3.5 space-y-3 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-foreground">{drilldownTitle}</span>
                <Badge variant="info" className="text-[11px]">
                  {filteredStudents.length} طالب
                </Badge>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="بحث بالطالب أو المجموعة..."
                    className="h-8 rounded-lg border border-input bg-background pr-8 pl-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDrilldown(null)}
                  className="h-8 px-2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                  إغلاق
                </Button>
              </div>
            </div>

            {filteredStudents.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                لا يوجد طلاب في هذه المرحلة حالياً.
              </p>
            ) : (
              <div className="max-h-72 overflow-y-auto rounded-lg border border-border">
                <table className="w-full text-right text-xs">
                  <thead className="sticky top-0 bg-muted/80 text-[11px] font-bold text-muted-foreground backdrop-blur">
                    <tr>
                      <th className="px-3 py-2">الطالب</th>
                      <th className="px-3 py-2">المجموعة</th>
                      <th className="px-3 py-2">التقدم</th>
                      <th className="px-3 py-2">الحالة</th>
                      {canViewFinance && <th className="px-3 py-2">السداد بالشهر</th>}
                      <th className="px-3 py-2">الهاتف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredStudents.map((item) => (
                      <tr key={item.enrollmentId} className="hover:bg-muted/30">
                        <td className="px-3 py-2">
                          {canViewStudents ? (
                            <Link
                              to={`/students/${item.studentId}`}
                              className="font-bold text-primary hover:underline block"
                            >
                              {item.studentName}
                            </Link>
                          ) : (
                            <span className="font-bold text-foreground block">{item.studentName}</span>
                          )}
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {item.studentCode}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          {canViewGroups ? (
                            <Link
                              to={`/groups/${item.groupId}`}
                              className="font-semibold text-foreground hover:text-primary hover:underline block"
                            >
                              {item.groupName}
                            </Link>
                          ) : (
                            <span className="font-semibold text-foreground block">{item.groupName}</span>
                          )}
                          <span className="text-[10px] text-muted-foreground">{item.subject}</span>
                        </td>
                        <td className="px-3 py-2 font-mono font-bold text-foreground tabular-nums">
                          {item.attendedSessions} / {item.targetSessions}
                        </td>
                        <td className="px-3 py-2">{getStatusBadge(item.status)}</td>
                        {canViewFinance && (
                          <td className="px-3 py-2">
                            {item.remainingBalance > 0 ? (
                              <Link
                                to="/finance?tab=student-billing"
                                className="inline-flex items-center gap-1 font-bold text-rose-600 hover:underline dark:text-rose-400"
                              >
                                متبقي {formatCurrency(item.remainingBalance)}
                              </Link>
                            ) : (
                              <Badge variant="success" className="text-[10px]">
                                مسدد
                              </Badge>
                            )}
                          </td>
                        )}
                        <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground" dir="ltr">
                          <span className="inline-flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {item.studentPhone || '—'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
