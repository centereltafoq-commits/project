import { Link } from 'react-router-dom';
import { Badge, Card } from '@/design-system';
import { formatCurrency, formatDateAr, formatTimeRangeAr } from '@/lib/formatters';
import { StudentProfileData } from './students.types';

const ENROLLMENT_STATUS_BADGE: Record<
  string,
  { label: string; variant: 'success' | 'warning' | 'danger' | 'neutral' }
> = {
  ACTIVE: { label: 'نشط', variant: 'success' },
  PAUSED: { label: 'موقوف مؤقتاً', variant: 'warning' },
  COMPLETED: { label: 'مكتمل', variant: 'neutral' },
  CANCELLED: { label: 'ملغي', variant: 'danger' },
};

const ATTENDANCE_STATUS_BADGE: Record<
  string,
  { label: string; variant: 'success' | 'danger' | 'warning' | 'purple' }
> = {
  PRESENT: { label: 'حاضر', variant: 'success' },
  ABSENT: { label: 'غائب', variant: 'danger' },
  EXCUSED: { label: 'غياب بعذر', variant: 'warning' },
};

export function StudentMonthlyFinancialTab({ data }: { data: StudentProfileData }) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-right text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-xs font-bold text-muted-foreground">
              <th className="px-4 py-3">المجموعة</th>
              <th className="px-4 py-3">حصص الشهر</th>
              <th className="px-4 py-3">حضور</th>
              <th className="px-4 py-3">غياب</th>
              <th className="px-4 py-3">بعذر</th>
              <th className="px-4 py-3">سعر الحصة</th>
              <th className="px-4 py-3">المستحق</th>
              <th className="px-4 py-3">المدفوع</th>
              <th className="px-4 py-3">المتبقي</th>
              <th className="px-4 py-3">حالة الشهر</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.monthlyBreakdown.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                  لا توجد اشتراكات أو سجلات مالية لهذا الشهر
                </td>
              </tr>
            ) : (
              data.monthlyBreakdown.map((item) => (
                <tr key={item.groupId} className="hover:bg-accent/30">
                  <td className="px-4 py-3 font-bold">
                    <Link to={`/groups/${item.groupId}`} className="text-primary hover:underline">
                      {item.groupName}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{item.totalSessions}</td>
                  <td className="px-4 py-3 font-semibold text-emerald-600">{item.presentCount}</td>
                  <td className="px-4 py-3 font-semibold text-rose-600">{item.absentCount}</td>
                  <td className="px-4 py-3 text-amber-600">{item.excusedCount}</td>
                  <td className="px-4 py-3">{formatCurrency(item.sessionPrice)}</td>
                  <td className="px-4 py-3 font-bold">{formatCurrency(item.totalDue)}</td>
                  <td className="px-4 py-3 font-semibold text-emerald-600">
                    {formatCurrency(item.totalPaid)}
                  </td>
                  <td className="px-4 py-3 font-bold text-rose-600">
                    {formatCurrency(item.remaining)}
                  </td>
                  <td className="px-4 py-3">
                    {item.isClosed ? (
                      <Badge variant="neutral">مقفل</Badge>
                    ) : (
                      <Badge variant="info">مفتوح</Badge>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {data.monthlyBreakdown.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/40 font-extrabold">
                <td className="px-4 py-3">إجمالي الشهر</td>
                <td className="px-4 py-3">{data.monthTotals.totalSessions}</td>
                <td className="px-4 py-3 text-emerald-600">{data.monthTotals.presentCount}</td>
                <td className="px-4 py-3 text-rose-600">{data.monthTotals.absentCount}</td>
                <td className="px-4 py-3 text-amber-600">{data.monthTotals.excusedCount}</td>
                <td className="px-4 py-3">—</td>
                <td className="px-4 py-3">{formatCurrency(data.monthTotals.totalDue)}</td>
                <td className="px-4 py-3 text-emerald-600">
                  {formatCurrency(data.monthTotals.totalPaid)}
                </td>
                <td className="px-4 py-3 text-rose-600">
                  {formatCurrency(data.monthTotals.remaining)}
                </td>
                <td className="px-4 py-3" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </Card>
  );
}

export function StudentEnrollmentsTab({ data }: { data: StudentProfileData }) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-right text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-xs font-bold text-muted-foreground">
              <th className="px-4 py-3">المجموعة</th>
              <th className="px-4 py-3">المادة والصف</th>
              <th className="px-4 py-3">المدرس الأساسي</th>
              <th className="px-4 py-3">تاريخ الاشتراك</th>
              <th className="px-4 py-3">تاريخ الإيقاف</th>
              <th className="px-4 py-3">الاشتراك المتفق عليه</th>
              <th className="px-4 py-3">سعر الحصة</th>
              <th className="px-4 py-3">الحالة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.enrollments.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  لم يشترك الطالب في أي مجموعات حتى الآن
                </td>
              </tr>
            ) : (
              data.enrollments.map((enr) => {
                const st = ENROLLMENT_STATUS_BADGE[enr.status] ?? {
                  label: enr.status,
                  variant: 'neutral' as const,
                };
                return (
                  <tr key={enr.id} className="hover:bg-accent/30">
                    <td className="px-4 py-3 font-bold">
                      <Link to={`/groups/${enr.groupId}`} className="text-primary hover:underline">
                        {enr.groupName} ({enr.groupCode})
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {enr.subject} - {enr.gradeLevel}
                    </td>
                    <td className="px-4 py-3">{enr.teacherName}</td>
                    <td className="px-4 py-3">{formatDateAr(enr.startDate)}</td>
                    <td className="px-4 py-3">{formatDateAr(enr.endDate)}</td>
                    <td className="px-4 py-3 font-semibold">
                      {formatCurrency(enr.agreedMonthlyPrice)} ({enr.agreedSessionsCount} حصص)
                    </td>
                    <td className="px-4 py-3">{formatCurrency(enr.agreedSessionPrice)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function StudentAttendanceTab({ data }: { data: StudentProfileData }) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-right text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-xs font-bold text-muted-foreground">
              <th className="px-4 py-3">تاريخ الحصة</th>
              <th className="px-4 py-3">المجموعة</th>
              <th className="px-4 py-3">الموعد</th>
              <th className="px-4 py-3">حالة الحضور</th>
              <th className="px-4 py-3">ملاحظات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.attendanceRecords.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
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
                    <td className="px-4 py-3">{rec.groupName}</td>
                    <td className="px-4 py-3">
                      {formatTimeRangeAr(rec.startTime, rec.endTime)}
                    </td>
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
  );
}
