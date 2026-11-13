import { Badge, Card } from '@/design-system';
import { formatCurrency, formatDateAr, formatYearMonthAr } from '@/lib/formatters';
import { PAYMENT_METHOD_LABELS } from '../students/students.types';
import { TeacherProfileData } from './teachers.types';

export function TeacherPayoutsTab({ data }: { data: TeacherProfileData }) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-right text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-xs font-bold text-muted-foreground">
              <th className="px-4 py-3">رقم المرجع</th>
              <th className="px-4 py-3">شهر الاستحقاق</th>
              <th className="px-4 py-3">المبلغ المنصرف</th>
              <th className="px-4 py-3">تاريخ الصرف</th>
              <th className="px-4 py-3">طريقة الصرف</th>
              <th className="px-4 py-3">ملاحظات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.payouts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  لا توجد عمليات صرف مسجلة للمدرس حتى الآن
                </td>
              </tr>
            ) : (
              data.payouts.map((p) => (
                <tr key={p.id} className="hover:bg-accent/30">
                  <td className="px-4 py-3 font-mono text-xs font-bold text-primary">
                    {p.referenceNumber}
                  </td>
                  <td className="px-4 py-3">{formatYearMonthAr(p.yearMonth)}</td>
                  <td className="px-4 py-3 font-extrabold text-emerald-600">
                    {formatCurrency(p.amount)}
                  </td>
                  <td className="px-4 py-3">{formatDateAr(p.payoutDate)}</td>
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
