import { Badge, Card } from '@/design-system';
import { formatCurrency, formatDateAr, formatYearMonthAr } from '@/lib/formatters';
import { PAYMENT_METHOD_LABELS, StudentProfileData } from './students.types';

const MAKEUP_STATUS_BADGE: Record<
  string,
  { label: string; variant: 'warning' | 'info' | 'success' | 'danger' }
> = {
  PENDING: { label: 'قيد الانتظار', variant: 'warning' },
  SCHEDULED: { label: 'مجدولة', variant: 'info' },
  COMPLETED: { label: 'تم الحضور', variant: 'success' },
  CANCELLED: { label: 'ملغاة', variant: 'danger' },
};

const BOOKING_STATUS_BADGE: Record<
  string,
  { label: string; variant: 'warning' | 'success' | 'danger' | 'neutral' }
> = {
  PENDING: { label: 'بانتظار الموافقة', variant: 'warning' },
  CONFIRMED: { label: 'مؤكد', variant: 'success' },
  REJECTED: { label: 'مرفوض', variant: 'danger' },
  CANCELLED: { label: 'ملغي', variant: 'neutral' },
  COMPLETED: { label: 'مكتمل', variant: 'success' },
};

export function StudentPaymentsTab({ data }: { data: StudentProfileData }) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-right text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-xs font-bold text-muted-foreground">
              <th className="px-4 py-3">رقم الإيصال</th>
              <th className="px-4 py-3">الشهر المالي</th>
              <th className="px-4 py-3">المبلغ المسدد</th>
              <th className="px-4 py-3">تاريخ الدفع</th>
              <th className="px-4 py-3">وسيلة الدفع</th>
              <th className="px-4 py-3">ملاحظات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.payments.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  لا توجد مدفوعات مسجلة لهذا الطالب
                </td>
              </tr>
            ) : (
              data.payments.map((p) => (
                <tr key={p.id} className="hover:bg-accent/30">
                  <td className="px-4 py-3 font-mono text-xs font-bold text-primary">
                    {p.receiptNumber}
                  </td>
                  <td className="px-4 py-3">{formatYearMonthAr(p.yearMonth)}</td>
                  <td className="px-4 py-3 font-extrabold text-emerald-600">
                    {formatCurrency(p.amount)}
                  </td>
                  <td className="px-4 py-3">{formatDateAr(p.paymentDate)}</td>
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
  );
}

export function StudentMakeupsTab({ data }: { data: StudentProfileData }) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-right text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-xs font-bold text-muted-foreground">
              <th className="px-4 py-3">المجموعة</th>
              <th className="px-4 py-3">تاريخ الغياب الأصلي</th>
              <th className="px-4 py-3">موعد التعويض</th>
              <th className="px-4 py-3">القاعة</th>
              <th className="px-4 py-3">الرسوم الإضافية</th>
              <th className="px-4 py-3">الحالة</th>
              <th className="px-4 py-3">ملاحظات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.makeupSessions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  لا توجد حصص تعويضية مسجلة للطالب
                </td>
              </tr>
            ) : (
              data.makeupSessions.map((m) => {
                const st = MAKEUP_STATUS_BADGE[m.status] ?? {
                  label: m.status,
                  variant: 'warning' as const,
                };
                return (
                  <tr key={m.id} className="hover:bg-accent/30">
                    <td className="px-4 py-3 font-bold">{m.groupName}</td>
                    <td className="px-4 py-3">{formatDateAr(m.absenceDate)}</td>
                    <td className="px-4 py-3">{formatDateAr(m.scheduledAt)}</td>
                    <td className="px-4 py-3">{m.classroomName || '—'}</td>
                    <td className="px-4 py-3">
                      {m.isFree ? (
                        <Badge variant="success">مجانية</Badge>
                      ) : (
                        <span className="font-semibold">{formatCurrency(m.extraFee)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{m.notes || '—'}</td>
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

export function StudentBookingsTab({ data }: { data: StudentProfileData }) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-right text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-xs font-bold text-muted-foreground">
              <th className="px-4 py-3">المدرس</th>
              <th className="px-4 py-3">الغرض من الموعد</th>
              <th className="px-4 py-3">التاريخ</th>
              <th className="px-4 py-3">الوقت</th>
              <th className="px-4 py-3">القاعة</th>
              <th className="px-4 py-3">الحالة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.bookings.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  لا توجد حجوزات أو مواعيد مسجلة للطالب
                </td>
              </tr>
            ) : (
              data.bookings.map((b) => {
                const st = BOOKING_STATUS_BADGE[b.status] ?? {
                  label: b.status,
                  variant: 'neutral' as const,
                };
                return (
                  <tr key={b.id} className="hover:bg-accent/30">
                    <td className="px-4 py-3 font-bold">{b.teacherName}</td>
                    <td className="px-4 py-3">{b.purpose}</td>
                    <td className="px-4 py-3">{formatDateAr(b.requestedDate)}</td>
                    <td className="px-4 py-3" dir="ltr">
                      {b.startTime} - {b.endTime}
                    </td>
                    <td className="px-4 py-3">{b.classroomName || 'لم تخصص بعد'}</td>
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
