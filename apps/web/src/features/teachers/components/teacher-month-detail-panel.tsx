import { Link } from 'react-router-dom';
import {
  BookOpen,
  CalendarCheck2,
  CheckCircle2,
  CreditCard,
  Lock,
  Users,
  Wallet,
} from 'lucide-react';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/design-system';
import {
  formatCurrency,
  formatDateAr,
  formatTimeRangeAr,
  formatYearMonthAr,
} from '@/lib/formatters';
import { PAYMENT_METHOD_LABELS } from '../../students/students.types';
import {
  SPLIT_METHOD_LABELS,
  TEACHER_PAYOUT_STATUS_META,
  TEACHER_SESSION_STATUS_META,
  TeacherPayoutStatus,
  TeacherProfileData,
} from '../teachers.types';

interface TeacherMonthDetailPanelProps {
  data: TeacherProfileData;
  selectedMonthStatus?: TeacherPayoutStatus;
  canViewFinance: boolean;
}

export function TeacherMonthDetailPanel({
  data,
  selectedMonthStatus,
  canViewFinance,
}: TeacherMonthDetailPanelProps) {
  const { groups, totals } = data.monthlyBreakdown;
  const monthSessions = data.monthSessions ?? [];
  const monthPayouts = data.payouts.filter((p) => p.yearMonth === data.yearMonth);

  const statusMeta = selectedMonthStatus
    ? TEACHER_PAYOUT_STATUS_META[selectedMonthStatus]
    : totals.totalDues <= 0.009
      ? TEACHER_PAYOUT_STATUS_META.NO_DUES
      : totals.remainingBalance <= 0.009
        ? TEACHER_PAYOUT_STATUS_META.PAID
        : totals.totalPayouts > 0.009
          ? TEACHER_PAYOUT_STATUS_META.PARTIAL
          : TEACHER_PAYOUT_STATUS_META.UNPAID;

  return (
    <div className="space-y-5 rounded-2xl border-2 border-primary/25 bg-card/60 p-4 sm:p-6 shadow-sm">
      {/* ترويسة الشهر المختار */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h3 className="text-lg font-black text-foreground">
              تفاصيل شهر {formatYearMonthAr(data.yearMonth)}
            </h3>
            <span className="rounded-md bg-primary/10 px-2.5 py-0.5 font-mono text-xs font-bold text-primary">
              {data.yearMonth}
            </span>
            {canViewFinance && <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>}
            {totals.isClosed && (
              <Badge variant="neutral">
                <Lock className="ml-1 inline h-3 w-3" />
                شهر مقفل مالياً
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            عرض تفصيلي شامل للمجموعات، الحصص المنفذة وحضور الطلاب، وسندات الصرف المسجلة خلال هذا الشهر
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="rounded-xl border border-border bg-muted/40 px-3.5 py-2">
            <span className="text-muted-foreground block">الحصص المنفذة بالشهر</span>
            <strong className="text-sm font-black text-foreground">
              {totals.executedSessionsCount} حصة ({totals.groupsCount} مجموعات)
            </strong>
          </div>
          {canViewFinance && (
            <>
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-3.5 py-2">
                <span className="text-muted-foreground block">إجمالي المستحق</span>
                <strong className="text-sm font-black text-emerald-600">
                  {formatCurrency(totals.totalDues)}
                </strong>
              </div>
              <div className="rounded-xl border border-blue-500/25 bg-blue-500/5 px-3.5 py-2">
                <span className="text-muted-foreground block">إجمالي المنصرف</span>
                <strong className="text-sm font-black text-blue-600">
                  {formatCurrency(totals.totalPayouts)}
                </strong>
              </div>
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-3.5 py-2">
                <span className="text-muted-foreground block">المتبقي للصرف</span>
                <strong className="text-sm font-black text-amber-600">
                  {formatCurrency(totals.remainingBalance)}
                </strong>
              </div>
            </>
          )}
        </div>
      </div>

      {/* أولاً: تفصيل المجموعات والعوائد في هذا الشهر */}
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border bg-muted/20 py-3.5">
          <CardTitle className="flex items-center gap-2 text-sm font-extrabold">
            <BookOpen className="h-4 w-4 text-primary" />
            أولاً: تفصيل المجموعات والحصص والعوائد في شهر {formatYearMonthAr(data.yearMonth)}
          </CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-right text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-xs font-bold text-muted-foreground">
                <th className="px-4 py-3">المجموعة</th>
                <th className="px-4 py-3">طريقة التقسيم</th>
                <th className="px-4 py-3">الحصص المنفذة</th>
                <th className="px-4 py-3">عدد الطلاب</th>
                {canViewFinance && (
                  <>
                    <th className="px-4 py-3">إجمالي عائد المجموعة</th>
                    <th className="px-4 py-3">نصيب المدرس</th>
                    <th className="px-4 py-3">نصيب السنتر</th>
                  </>
                )}
                <th className="px-4 py-3">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {groups.length === 0 ? (
                <tr>
                  <td
                    colSpan={canViewFinance ? 8 : 5}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    لا توجد مجموعات أو حصص مسجلة لهذا الشهر
                  </td>
                </tr>
              ) : (
                groups.map((g) => (
                  <tr key={g.groupId} className="hover:bg-accent/30">
                    <td className="px-4 py-3 font-bold">
                      <Link to={`/groups/${g.groupId}`} className="text-primary hover:underline">
                        {g.groupName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {SPLIT_METHOD_LABELS[g.revenueSplitMethod] ?? g.revenueSplitMethod}
                    </td>
                    <td className="px-4 py-3 font-semibold">{g.executedSessionsCount} حصة</td>
                    <td className="px-4 py-3">{g.studentsCount} طالب</td>
                    {canViewFinance && (
                      <>
                        <td className="px-4 py-3">{formatCurrency(g.grossRevenue)}</td>
                        <td className="px-4 py-3 font-extrabold text-emerald-600">
                          {formatCurrency(g.teacherShare)}
                        </td>
                        <td className="px-4 py-3 font-semibold text-primary">
                          {formatCurrency(g.centerShare)}
                        </td>
                      </>
                    )}
                    <td className="px-4 py-3">
                      {g.isLocked ? (
                        <Badge variant="neutral">مقفل</Badge>
                      ) : (
                        <Badge variant="info">تراكمي مباشر</Badge>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {groups.length > 0 && canViewFinance && (
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/40 font-extrabold">
                  <td className="px-4 py-3" colSpan={2}>
                    الإجمالي الشهري للمجموعات
                  </td>
                  <td className="px-4 py-3">{totals.executedSessionsCount} حصة</td>
                  <td className="px-4 py-3">—</td>
                  <td className="px-4 py-3">—</td>
                  <td className="px-4 py-3 text-emerald-600">
                    {formatCurrency(totals.totalDues)}
                  </td>
                  <td className="px-4 py-3" colSpan={2}>
                    المنصرف: {formatCurrency(totals.totalPayouts)} • المتبقي:{' '}
                    {formatCurrency(totals.remainingBalance)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      {/* ثانياً: سجل الحصص المنفذة والجدول الفعلي في هذا الشهر */}
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border bg-muted/20 py-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-sm font-extrabold">
              <CalendarCheck2 className="h-4 w-4 text-primary" />
              ثانياً: سجل الحصص في شهر {formatYearMonthAr(data.yearMonth)} ({monthSessions.length}{' '}
              حصة)
            </CardTitle>
            <span className="text-xs text-muted-foreground">
              مرتبة من الأحدث إلى الأقدم مع عدد الطلاب الحاضرين بكل حصة
            </span>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-right text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-xs font-bold text-muted-foreground">
                <th className="px-4 py-3">تاريخ الحصة</th>
                <th className="px-4 py-3">المجموعة</th>
                <th className="px-4 py-3">الموعد</th>
                <th className="px-4 py-3">عدد الحضور</th>
                <th className="px-4 py-3">حالة الحصة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {monthSessions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    لا توجد حصص مسجلة لهذا المدرس خلال شهر {formatYearMonthAr(data.yearMonth)}
                  </td>
                </tr>
              ) : (
                monthSessions.map((session) => {
                  const sessionMeta = TEACHER_SESSION_STATUS_META[session.status] ?? {
                    label: session.status,
                    variant: 'info' as const,
                  };
                  return (
                    <tr key={session.id} className="hover:bg-accent/30">
                      <td className="px-4 py-3 font-semibold">
                        {formatDateAr(session.sessionDate)}
                      </td>
                      <td className="px-4 py-3 font-bold">
                        <Link
                          to={`/groups/${session.groupId}`}
                          className="text-primary hover:underline"
                        >
                          {session.groupName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatTimeRangeAr(session.startTime, session.endTime)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-600">
                          <Users className="h-3 w-3" />
                          {session.presentCount} حاضر
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={sessionMeta.variant}>{sessionMeta.label}</Badge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ثالثاً: دفعات وسندات الصرف المسجلة للمدرس في هذا الشهر */}
      {canViewFinance && (
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border bg-muted/20 py-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-sm font-extrabold">
                <CreditCard className="h-4 w-4 text-emerald-600" />
                ثالثاً: دفعات وسندات الصرف المسجلة لشهر {formatYearMonthAr(data.yearMonth)} (
                {monthPayouts.length})
              </CardTitle>
              <span className="text-xs font-bold text-emerald-600">
                إجمالي المنصرف للشهر: {formatCurrency(totals.totalPayouts)}
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-right text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-xs font-bold text-muted-foreground">
                    <th className="px-4 py-3">رقم المرجع</th>
                    <th className="px-4 py-3">تاريخ الصرف</th>
                    <th className="px-4 py-3">المبلغ المنصرف</th>
                    <th className="px-4 py-3">طريقة الدفع</th>
                    <th className="px-4 py-3">ملاحظات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {monthPayouts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        لم يتم تسجيل أي دفعات صرف لهذا الشهر حتى الآن
                      </td>
                    </tr>
                  ) : (
                    monthPayouts.map((p) => (
                      <tr key={p.id} className="hover:bg-accent/30">
                        <td className="px-4 py-3 font-mono text-xs font-bold text-primary">
                          {p.referenceNumber}
                        </td>
                        <td className="px-4 py-3">{formatDateAr(p.payoutDate)}</td>
                        <td className="px-4 py-3 font-extrabold text-emerald-600">
                          <CheckCircle2 className="ml-1 inline h-3.5 w-3.5" />
                          {formatCurrency(p.amount)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="info">
                            {PAYMENT_METHOD_LABELS[p.paymentMethod] ?? p.paymentMethod}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{p.notes || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
