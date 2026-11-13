import { Badge, Card } from '@/design-system';
import { formatCurrency, formatDateAr, formatYearMonthAr } from '@/lib/formatters';
import { PAYMENT_METHOD_LABELS, StudentProfileData } from './students.types';

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
