import { Badge, TableColumn } from '@/design-system';
import { cn } from '@/lib/cn';
import { formatCurrency, formatDateAr, formatDateTimeAr } from '@/lib/formatters';

type Row = Record<string, unknown>;

export function getCollectionsColumns(): TableColumn<Row>[] {
  return [
    {
      key: 'receiptNumber',
      header: 'رقم الإيصال',
      render: (r) => (
        <span className="font-mono text-xs font-bold text-primary">{String(r.receiptNumber)}</span>
      ),
    },
    {
      key: 'paymentDate',
      header: 'تاريخ ووقت التحصيل',
      render: (r) => <span className="text-xs font-semibold">{formatDateTimeAr(String(r.paymentDate))}</span>,
    },
    {
      key: 'studentName',
      header: 'الطالب',
      render: (r) => <span className="font-bold">{String(r.studentName)}</span>,
    },
    {
      key: 'amount',
      header: 'المبلغ المحصّل',
      render: (r) => (
        <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
          {formatCurrency(Number(r.amount))}
        </span>
      ),
    },
    {
      key: 'paymentMethodAr',
      header: 'طريقة الدفع',
      render: (r) => <Badge variant="info">{String(r.paymentMethodAr)}</Badge>,
    },
    {
      key: 'collectorName',
      header: 'المحصّل',
      render: (r) => <span className="text-xs font-medium">{String(r.collectorName)}</span>,
    },
  ];
}

export function getExpensesColumns(): TableColumn<Row>[] {
  return [
    {
      key: 'expenseDate',
      header: 'التاريخ',
      render: (r) => <span className="text-xs font-semibold">{formatDateAr(String(r.expenseDate))}</span>,
    },
    {
      key: 'categoryAr',
      header: 'البند / الفئة',
      render: (r) => <Badge variant="warning">{String(r.categoryAr)}</Badge>,
    },
    {
      key: 'title',
      header: 'الوصف',
      render: (r) => <span className="font-bold">{String(r.title)}</span>,
    },
    {
      key: 'amount',
      header: 'المبلغ',
      render: (r) => (
        <span className="font-extrabold text-rose-600 dark:text-rose-400">
          {formatCurrency(Number(r.amount))}
        </span>
      ),
    },
    {
      key: 'paymentMethodAr',
      header: 'طريقة الدفع',
      render: (r) => <Badge variant="neutral">{String(r.paymentMethodAr)}</Badge>,
    },
  ];
}

export function getFinancialSummaryColumns(): TableColumn<Row>[] {
  return [
    {
      key: 'sectionAr',
      header: 'القسم المالي',
      render: (r) => <Badge variant="neutral">{String(r.sectionAr)}</Badge>,
    },
    {
      key: 'lineItemAr',
      header: 'البند المحاسبي',
      render: (r) => (
        <span
          className={cn(
            'font-semibold',
            r.rowKind === 'NET' && 'text-base font-extrabold text-primary',
          )}
        >
          {String(r.lineItemAr)}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'القيمة',
      render: (r) => {
        const val = Number(r.amount ?? 0);
        const kind = String(r.rowKind);
        return (
          <span
            className={cn(
              'font-bold',
              kind === 'INFLOW' && 'text-emerald-600 dark:text-emerald-400',
              kind === 'DEDUCTION' && 'text-rose-600 dark:text-rose-400',
              kind === 'NET' && 'text-base font-extrabold text-primary',
            )}
          >
            {formatCurrency(val)}
          </span>
        );
      },
    },
    {
      key: 'notes',
      header: 'الإيضاح',
      render: (r) => <span className="text-xs text-muted-foreground">{String(r.notes ?? '')}</span>,
    },
  ];
}
