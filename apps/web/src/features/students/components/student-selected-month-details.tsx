import { Link } from 'react-router-dom';
import {
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  Clock,
  CreditCard,
  Receipt,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { Badge, Card } from '@/design-system';
import {
  formatCurrency,
  formatDateAr,
  formatTimeRangeAr,
  formatYearMonthAr,
} from '@/lib/formatters';
import { PAYMENT_METHOD_LABELS, StudentProfileData } from '../students.types';

const ATTENDANCE_STATUS_BADGE: Record<
  string,
  { label: string; variant: 'success' | 'danger' | 'warning' }
> = {
  PRESENT: { label: 'حاضر', variant: 'success' },
  ABSENT: { label: 'غائب', variant: 'danger' },
  EXCUSED: { label: 'غياب بعذر', variant: 'warning' },
};

function getGroupPaymentBadge(totalDue: number, totalPaid: number, remaining: number) {
  if (totalDue <= 0.009) {
    return { label: 'لا توجد مستحقات', variant: 'neutral' as const };
  }
  if (remaining <= 0.009) {
    return { label: 'مدفوع بالكامل', variant: 'success' as const };
  }
  if (totalPaid > 0.009) {
    return { label: 'مدفوع جزئياً', variant: 'warning' as const };
  }
  return { label: 'غير مدفوع', variant: 'danger' as const };
}

interface StudentSelectedMonthDetailsProps {
  data: StudentProfileData;
  canViewFinance: boolean;
}

export function StudentSelectedMonthDetails({
  data,
  canViewFinance,
}: StudentSelectedMonthDetailsProps) {
  const monthPayments = data.payments.filter((p) => p.yearMonth === data.yearMonth);
  const { monthTotals } = data;
  const monthPaymentBadge = getGroupPaymentBadge(
    monthTotals.totalDue,
    monthTotals.totalPaid,
    monthTotals.remaining,
  );

  return (
    <div className="space-y-5 rounded-2xl border-2 border-primary/25 bg-card/60 p-5 shadow-sm">
      {/* ترويسة الشهر المختار */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CalendarCheck className="h-6 w-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-black text-foreground">
                تفاصيل شهر {formatYearMonthAr(data.yearMonth)}
              </h3>
              <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs font-bold text-muted-foreground">
                {data.yearMonth}
              </span>
              {canViewFinance && (
                <Badge variant={monthPaymentBadge.variant}>{monthPaymentBadge.label}</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              عرض تفصيلي شامل للمجموعات، الحصص التي حضرها أو غابها، وحالة السداد في هذا الشهر
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            حضر {monthTotals.presentCount} من {monthTotals.totalSessions} حصة
          </span>
          {monthTotals.absentCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-rose-700 dark:text-rose-400">
              <XCircle className="h-3.5 w-3.5" />
              غياب: {monthTotals.absentCount}
            </span>
          )}
          {monthTotals.excusedCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-amber-700 dark:text-amber-400">
              <Clock className="h-3.5 w-3.5" />
              بعذر: {monthTotals.excusedCount}
            </span>
          )}
        </div>
      </div>

      {/* أولاً: المجموعات وحساب الشهر */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h4 className="flex items-center gap-2 text-sm font-extrabold text-foreground">
            <BookOpen className="h-4 w-4 text-primary" />
            أولاً: المجموعات وحساب شهر {formatYearMonthAr(data.yearMonth)} (
            {data.monthlyBreakdown.length})
          </h4>
        </div>

        <Card className="overflow-hidden border border-border">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-right text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-xs font-bold text-muted-foreground">
                  <th className="px-4 py-3">المجموعة</th>
                  <th className="px-4 py-3">حصص الشهر</th>
                  <th className="px-4 py-3">حضر</th>
                  <th className="px-4 py-3">غاب</th>
                  <th className="px-4 py-3">بعذر</th>
                  {canViewFinance && (
                    <>
                      <th className="px-4 py-3">سعر الحصة</th>
                      <th className="px-4 py-3">المستحق</th>
                      <th className="px-4 py-3">المدفوع</th>
                      <th className="px-4 py-3">المتبقي</th>
                      <th className="px-4 py-3">حالة الدفع</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.monthlyBreakdown.length === 0 ? (
                  <tr>
                    <td
                      colSpan={canViewFinance ? 10 : 5}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      لا توجد مجموعات أو حصص مسجلة للطالب في هذا الشهر
                    </td>
                  </tr>
                ) : (
                  data.monthlyBreakdown.map((item) => {
                    const groupBadge = getGroupPaymentBadge(
                      item.totalDue,
                      item.totalPaid,
                      item.remaining,
                    );
                    return (
                      <tr key={item.groupId} className="hover:bg-accent/30">
                        <td className="px-4 py-3 font-bold">
                          <Link
                            to={`/groups/${item.groupId}`}
                            className="text-primary hover:underline"
                          >
                            {item.groupName}
                          </Link>
                        </td>
                        <td className="px-4 py-3 font-semibold">{item.totalSessions} حصة</td>
                        <td className="px-4 py-3 font-bold text-emerald-600">
                          {item.presentCount} حصة
                        </td>
                        <td className="px-4 py-3 font-bold text-rose-600">{item.absentCount}</td>
                        <td className="px-4 py-3 font-semibold text-amber-600">
                          {item.excusedCount}
                        </td>
                        {canViewFinance && (
                          <>
                            <td className="px-4 py-3">{formatCurrency(item.sessionPrice)}</td>
                            <td className="px-4 py-3 font-bold">{formatCurrency(item.totalDue)}</td>
                            <td className="px-4 py-3 font-bold text-emerald-600">
                              {formatCurrency(item.totalPaid)}
                            </td>
                            <td className="px-4 py-3 font-bold text-rose-600">
                              {formatCurrency(item.remaining)}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <Badge variant={groupBadge.variant}>{groupBadge.label}</Badge>
                                {item.isClosed && <Badge variant="neutral">مقفل</Badge>}
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
              {data.monthlyBreakdown.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/40 font-extrabold">
                    <td className="px-4 py-3">إجمالي الشهر</td>
                    <td className="px-4 py-3">{monthTotals.totalSessions} حصة</td>
                    <td className="px-4 py-3 text-emerald-600">{monthTotals.presentCount} حصة</td>
                    <td className="px-4 py-3 text-rose-600">{monthTotals.absentCount}</td>
                    <td className="px-4 py-3 text-amber-600">{monthTotals.excusedCount}</td>
                    {canViewFinance && (
                      <>
                        <td className="px-4 py-3">—</td>
                        <td className="px-4 py-3">{formatCurrency(monthTotals.totalDue)}</td>
                        <td className="px-4 py-3 text-emerald-600">
                          {formatCurrency(monthTotals.totalPaid)}
                        </td>
                        <td className="px-4 py-3 text-rose-600">
                          {formatCurrency(monthTotals.remaining)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={monthPaymentBadge.variant}>
                            {monthPaymentBadge.label}
                          </Badge>
                        </td>
                      </>
                    )}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Card>
      </div>

      {/* ثانياً: سجل الحضور والغياب التفصيلي في هذا الشهر */}
      <div className="space-y-2.5">
        <h4 className="flex items-center gap-2 text-sm font-extrabold text-foreground">
          <UserCheck className="h-4 w-4 text-emerald-600" />
          ثانياً: سجل الحصص والحضور في شهر {formatYearMonthAr(data.yearMonth)} (
          {data.attendanceRecords.length})
        </h4>

        <Card className="overflow-hidden border border-border">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-right text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-xs font-bold text-muted-foreground">
                  <th className="px-4 py-3">تاريخ الحصة</th>
                  <th className="px-4 py-3">المجموعة</th>
                  <th className="px-4 py-3">وقت الحصة</th>
                  <th className="px-4 py-3">موضوع الحصة</th>
                  <th className="px-4 py-3">حالة الحضور</th>
                  <th className="px-4 py-3">ملاحظات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.attendanceRecords.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      لا توجد سجلات حضور أو غياب مسجلة لهذا الشهر
                    </td>
                  </tr>
                ) : (
                  data.attendanceRecords.map((rec) => {
                    const st = ATTENDANCE_STATUS_BADGE[rec.status] ?? {
                      label: rec.status,
                      variant: 'warning' as const,
                    };
                    return (
                      <tr key={rec.id} className="hover:bg-accent/30">
                        <td className="px-4 py-3 font-semibold">{formatDateAr(rec.sessionDate)}</td>
                        <td className="px-4 py-3 font-medium">{rec.groupName}</td>
                        <td className="px-4 py-3">
                          {formatTimeRangeAr(rec.startTime, rec.endTime)}
                        </td>
                        <td className="px-4 py-3">{rec.topic || '—'}</td>
                        <td className="px-4 py-3">
                          <Badge variant={st.variant}>{st.label}</Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{rec.notes || '—'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* ثالثاً: إيصالات السداد المسجلة لهذا الشهر */}
      {canViewFinance && (
        <div className="space-y-2.5">
          <h4 className="flex items-center gap-2 text-sm font-extrabold text-foreground">
            <Receipt className="h-4 w-4 text-purple-600" />
            ثالثاً: إيصالات السداد المسجلة لشهر {formatYearMonthAr(data.yearMonth)} (
            {monthPayments.length})
          </h4>

          <Card className="overflow-hidden border border-border">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-right text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-xs font-bold text-muted-foreground">
                    <th className="px-4 py-3">رقم الإيصال</th>
                    <th className="px-4 py-3">تاريخ الدفع</th>
                    <th className="px-4 py-3">المبلغ المسدد</th>
                    <th className="px-4 py-3">وسيلة الدفع</th>
                    <th className="px-4 py-3">ملاحظات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {monthPayments.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-1">
                          <CreditCard className="h-5 w-5 text-muted-foreground/60" />
                          <span>لم يتم تسجيل أي إيصالات دفع لهذا الشهر حتى الآن</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    monthPayments.map((p) => (
                      <tr key={p.id} className="hover:bg-accent/30">
                        <td className="px-4 py-3 font-mono text-xs font-bold text-primary">
                          {p.receiptNumber}
                        </td>
                        <td className="px-4 py-3">{formatDateAr(p.paymentDate)}</td>
                        <td className="px-4 py-3 font-extrabold text-emerald-600">
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
          </Card>
        </div>
      )}
    </div>
  );
}
