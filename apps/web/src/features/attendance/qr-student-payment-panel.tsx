import { Link } from 'react-router-dom';
import {
  AlertOctagon,
  BookOpen,
  CalendarCheck2,
  CheckCircle2,
  Clock,
  CreditCard,
  ExternalLink,
  Lock,
  Phone,
  ShieldCheck,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { Badge, Button, Card } from '@/design-system';
import { formatCurrency, formatDateAr, formatYearMonthAr } from '@/lib/formatters';
import { QrLookupResponse, QrTodaySessionCandidate } from './qr-attendance.types';

interface QrStudentPaymentPanelProps {
  lookup: QrLookupResponse;
  canCollectPayment: boolean;
  canRecordAttendance: boolean;
  isCheckingIn: boolean;
  onCollectOverdue: (yearMonth: string, remaining: number) => void;
  onCheckIn: (candidate: QrTodaySessionCandidate) => void;
}

const MONTH_STATUS_META = {
  PAID: {
    label: 'مدفوع',
    cardClass: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300',
    badgeVariant: 'success' as const,
  },
  PARTIAL: {
    label: 'جزئي',
    cardClass: 'border-amber-500/45 bg-amber-500/10 text-amber-800 dark:text-amber-300',
    badgeVariant: 'warning' as const,
  },
  UNPAID: {
    label: 'لم يُدفع',
    cardClass: 'border-rose-500/50 bg-rose-500/10 text-rose-800 dark:text-rose-300',
    badgeVariant: 'danger' as const,
  },
  NO_DUES: {
    label: 'بدون رسوم',
    cardClass: 'border-border bg-muted/30 text-muted-foreground',
    badgeVariant: 'neutral' as const,
  },
};

export function QrStudentPaymentPanel({
  lookup,
  canCollectPayment,
  canRecordAttendance,
  isCheckingIn,
  onCollectOverdue,
  onCheckIn,
}: QrStudentPaymentPanelProps) {
  const { student, paymentGate, monthsOverview, todaySessions, canSeeAmounts } = lookup;
  const oldestUnpaid = paymentGate.unpaidMonths[0];

  return (
    <div className="space-y-4">
      {/* 1. لافتة الإنذار المالي أو السماح بالدخول */}
      {paymentGate.isBlocked ? (
        <div
          role="alert"
          className="animate-pulse rounded-2xl border-2 border-rose-600 bg-rose-600/10 p-5 shadow-md"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white shadow">
                <AlertOctagon className="h-7 w-7" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-black text-rose-700 dark:text-rose-300">
                    إنذار مالي — ممنوع تسجيل الحضور قبل السداد!
                  </h3>
                  <Badge variant="danger">بوابة الدخول مغلقة</Badge>
                </div>
                <p className="text-sm font-bold text-rose-800/90 dark:text-rose-200">
                  الطالب عليه {paymentGate.unpaidMonthsCount} شهر غير مسدد بالكامل
                  {canSeeAmounts && ` بإجمالي متأخرات ${formatCurrency(paymentGate.totalRemaining)}`}
                  {' — '}يجب تحصيل المستحقات أولاً ليتم فتح الحضور.
                </p>
              </div>
            </div>

            {canCollectPayment && oldestUnpaid && (
              <Button
                variant="danger"
                size="lg"
                onClick={() => onCollectOverdue(oldestUnpaid.yearMonth, oldestUnpaid.remaining)}
                className="shrink-0 gap-2 font-black shadow"
              >
                <CreditCard className="h-5 w-5" />
                تحصيل المستحقات الآن ({formatYearMonthAr(oldestUnpaid.yearMonth)})
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-emerald-500/60 bg-emerald-500/10 p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-emerald-800 dark:text-emerald-300">
                  مسموح بالدخول — الطالب خالص المستحقات
                </h3>
                <p className="text-xs font-semibold text-emerald-700/80 dark:text-emerald-300/80">
                  لا توجد أي متأخرات مالية على الطالب حتى تاريخ {formatDateAr(lookup.todayDate)}
                </p>
              </div>
            </div>
            <Badge variant="success" className="px-3 py-1 text-xs">
              بوابة الحضور مفتوحة
            </Badge>
          </div>
        </div>
      )}

      {/* 2. بيانات الطالب الأساسية + الشهور المالية + حصص اليوم */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* بطاقة بيانات الطالب وخريطة الشهور */}
        <Card className="space-y-4 p-5 xl:col-span-7">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-xl font-black text-foreground">{student.fullName}</h4>
                <Badge variant="neutral" className="font-mono">
                  {student.studentCode}
                </Badge>
                <Badge variant={student.status === 'ACTIVE' ? 'success' : 'danger'}>
                  {student.status === 'ACTIVE' ? 'نشط' : student.status}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <span>الصف: <strong className="text-foreground">{student.gradeLevel}</strong></span>
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5 text-primary" />
                  الطالب: <strong dir="ltr" className="text-foreground">{student.phone || '—'}</strong>
                </span>
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5 text-emerald-600" />
                  ولي الأمر: <strong dir="ltr" className="text-foreground">{student.guardianPhone || '—'}</strong>
                </span>
              </div>
            </div>

            <Link
              to={`/students/${student.id}`}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-bold text-primary hover:bg-muted"
            >
              فتح البروفايل
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* خريطة شهور الدفع السريعة (دفع شهر إيه ومدفعش شهر إيه) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h5 className="flex items-center gap-1.5 text-sm font-black text-foreground">
                <CalendarCheck2 className="h-4 w-4 text-primary" />
                حالة دفع الشهور (دفع شهر إيه ومدفعش إيه)
              </h5>
              {canSeeAmounts && paymentGate.totalRemaining > 0.009 && (
                <span className="text-xs font-black text-rose-600">
                  المتبقي الكلي: {formatCurrency(paymentGate.totalRemaining)}
                </span>
              )}
            </div>

            {monthsOverview.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                لا توجد شهور مسجلة لهذا الطالب بعد
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
                {monthsOverview.slice(0, 12).map((m) => {
                  const meta = MONTH_STATUS_META[m.paymentStatus];
                  const isOverdue = m.remaining > 0.009;
                  return (
                    <div
                      key={m.yearMonth}
                      className={`flex flex-col justify-between rounded-xl border p-3 transition-all ${meta.cardClass}`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div>
                          <div className="text-xs font-black">{formatYearMonthAr(m.yearMonth)}</div>
                          <div className="font-mono text-[10px] opacity-75">{m.yearMonth}</div>
                        </div>
                        {m.paymentStatus === 'PAID' && <CheckCircle2 className="h-4 w-4 shrink-0" />}
                        {(m.paymentStatus === 'UNPAID' || m.paymentStatus === 'PARTIAL') && (
                          <XCircle className="h-4 w-4 shrink-0" />
                        )}
                      </div>

                      <div className="mt-2 space-y-1">
                        <Badge variant={meta.badgeVariant} className="text-[10px]">
                          {meta.label}
                        </Badge>
                        {canSeeAmounts && isOverdue && (
                          <div className="flex items-center justify-between gap-1 pt-0.5 text-[11px] font-black">
                            <span>متبقي: {formatCurrency(m.remaining)}</span>
                            {canCollectPayment && (
                              <button
                                type="button"
                                onClick={() => onCollectOverdue(m.yearMonth, m.remaining)}
                                className="rounded bg-rose-600 px-1.5 py-0.5 text-[10px] text-white hover:bg-rose-700"
                              >
                                سداد
                              </button>
                            )}
                          </div>
                        )}
                        {canSeeAmounts && !isOverdue && m.totalPaid > 0 && (
                          <div className="text-[11px] font-bold">
                            دُفع: {formatCurrency(m.totalPaid)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>

        {/* بطاقة تسجيل حضور حصص اليوم */}
        <Card className="flex flex-col justify-between space-y-4 p-5 xl:col-span-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h5 className="flex items-center gap-2 text-sm font-black text-foreground">
                <BookOpen className="h-4 w-4 text-primary" />
                حصص الطالب اليوم ({todaySessions.length})
              </h5>
              <span className="font-mono text-xs text-muted-foreground">{lookup.todayDate}</span>
            </div>

            {todaySessions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                الطالب غير مشترك في أي مجموعة نشطة حالياً.
              </div>
            ) : (
              <div className="space-y-2.5">
                {todaySessions.map((session) => {
                  const isPresent = session.attendanceStatus === 'PRESENT';
                  const key = session.sessionId ?? `virtual-${session.groupId}`;

                  return (
                    <div
                      key={key}
                      className={`rounded-xl border p-3.5 transition-all ${
                        isPresent
                          ? 'border-emerald-500/40 bg-emerald-500/5'
                          : paymentGate.isBlocked
                            ? 'border-rose-500/30 bg-rose-500/5'
                            : 'border-border bg-card'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-black text-foreground">{session.groupName}</p>
                          <p className="text-xs text-muted-foreground">
                            {session.subject} • {session.teacherName}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {session.startTime} - {session.endTime}
                            </span>
                            {session.classroomName && (
                              <span>• {session.classroomName}</span>
                            )}
                            {session.isVirtualSlot && (
                              <Badge variant={session.isScheduledToday ? 'info' : 'neutral'} className="text-[10px]">
                                {session.isScheduledToday ? 'موعد اليوم (سيُفتح تلقائياً)' : 'فتح حصة سريعة'}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {isPresent ? (
                          <Badge variant="success" className="gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            تم تسجيل الحضور
                          </Badge>
                        ) : paymentGate.isBlocked ? (
                          <Button size="sm" variant="danger" disabled className="gap-1 opacity-80">
                            <Lock className="h-3.5 w-3.5" />
                            مقفل (عليه متأخرات)
                          </Button>
                        ) : canRecordAttendance ? (
                          <Button
                            size="sm"
                            variant="primary"
                            isLoading={isCheckingIn}
                            onClick={() => onCheckIn(session)}
                            className="gap-1.5"
                          >
                            <UserCheck className="h-3.5 w-3.5" />
                            تسجيل حضور الآن
                          </Button>
                        ) : (
                          <Badge variant="neutral">للعرض فقط</Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
