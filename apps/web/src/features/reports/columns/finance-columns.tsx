import { Badge, TableColumn } from '@/design-system';
import { formatCurrency, formatYearMonthAr } from '@/lib/formatters';

type Row = Record<string, unknown>;

export function getStudentStatementColumns(): TableColumn<Row>[] {
  return [
    {
      key: 'student',
      header: 'الطالب',
      render: (r) => (
        <div>
          <p className="font-bold text-foreground">{String(r.studentName)}</p>
          <p className="font-mono text-xs text-muted-foreground">{String(r.studentCode)}</p>
        </div>
      ),
    },
    {
      key: 'groupName',
      header: 'المجموعة',
      render: (r) => <span className="font-semibold">{String(r.groupName)}</span>,
    },
    {
      key: 'yearMonth',
      header: 'الشهر',
      render: (r) => <span className="text-xs font-bold">{formatYearMonthAr(String(r.yearMonth))}</span>,
    },
    {
      key: 'totalDue',
      header: 'المستحق',
      render: (r) => <span className="font-bold">{formatCurrency(Number(r.totalDue))}</span>,
    },
    {
      key: 'totalPaid',
      header: 'المدفوع',
      render: (r) => (
        <span className="font-bold text-emerald-600 dark:text-emerald-400">
          {formatCurrency(Number(r.totalPaid))}
        </span>
      ),
    },
    {
      key: 'remainingBalance',
      header: 'المتبقي',
      render: (r) => {
        const rem = Number(r.remainingBalance ?? 0);
        return <Badge variant={rem > 0 ? 'danger' : 'success'}>{formatCurrency(rem)}</Badge>;
      },
    },
  ];
}

export function getGroupsRevenueColumns(): TableColumn<Row>[] {
  return [
    {
      key: 'groupName',
      header: 'المجموعة',
      render: (r) => (
        <div>
          <p className="font-bold text-foreground">{String(r.groupName)}</p>
          <p className="font-mono text-xs text-muted-foreground">{String(r.groupCode)}</p>
        </div>
      ),
    },
    {
      key: 'teacherName',
      header: 'المدرس',
      render: (r) => <span className="font-semibold">{String(r.teacherName)}</span>,
    },
    {
      key: 'studentsCount',
      header: 'عدد الطلاب',
      render: (r) => <Badge variant="info">{Number(r.studentsCount)} طالب</Badge>,
    },
    {
      key: 'grossRevenue',
      header: 'إجمالي المستحق',
      render: (r) => <span className="font-bold">{formatCurrency(Number(r.grossRevenue))}</span>,
    },
    {
      key: 'teacherShare',
      header: 'نصيب المدرس',
      render: (r) => (
        <span className="font-semibold text-amber-600 dark:text-amber-400">
          {formatCurrency(Number(r.teacherShare))}
        </span>
      ),
    },
    {
      key: 'centerShare',
      header: 'نصيب السنتر',
      render: (r) => (
        <span className="font-bold text-emerald-600 dark:text-emerald-400">
          {formatCurrency(Number(r.centerShare))}
        </span>
      ),
    },
  ];
}

export function getTeacherStatementColumns(): TableColumn<Row>[] {
  return [
    {
      key: 'teacherName',
      header: 'المدرس',
      render: (r) => (
        <div>
          <p className="font-bold">{String(r.teacherName)}</p>
          <p className="text-xs text-muted-foreground">{String(r.specialization)}</p>
        </div>
      ),
    },
    {
      key: 'yearMonth',
      header: 'الشهر',
      render: (r) => <span className="text-xs font-bold">{formatYearMonthAr(String(r.yearMonth))}</span>,
    },
    {
      key: 'groupsCount',
      header: 'المجموعات',
      render: (r) => <Badge variant="purple">{Number(r.groupsCount)}</Badge>,
    },
    {
      key: 'executedSessionsCount',
      header: 'الحصص المنفذة',
      render: (r) => <Badge variant="info">{Number(r.executedSessionsCount)} حصة</Badge>,
    },
    {
      key: 'totalDues',
      header: 'إجمالي المستحق',
      render: (r) => <span className="font-bold">{formatCurrency(Number(r.totalDues))}</span>,
    },
    {
      key: 'totalPaidOut',
      header: 'المنصرف',
      render: (r) => (
        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
          {formatCurrency(Number(r.totalPaidOut))}
        </span>
      ),
    },
    {
      key: 'remainingBalance',
      header: 'المتبقي',
      render: (r) => (
        <Badge variant={Number(r.remainingBalance) > 0 ? 'warning' : 'success'}>
          {formatCurrency(Number(r.remainingBalance))}
        </Badge>
      ),
    },
  ];
}

export function getAssistantStatementColumns(): TableColumn<Row>[] {
  return [
    {
      key: 'assistantName',
      header: 'المساعد',
      render: (r) => (
        <div>
          <p className="font-bold">{String(r.assistantName)}</p>
          <p className="font-mono text-xs text-muted-foreground">{String(r.assistantCode)}</p>
        </div>
      ),
    },
    {
      key: 'yearMonth',
      header: 'الشهر',
      render: (r) => <span className="text-xs font-bold">{formatYearMonthAr(String(r.yearMonth))}</span>,
    },
    {
      key: 'calculationMethodAr',
      header: 'طريقة الحساب',
      render: (r) => <Badge variant="info">{String(r.calculationMethodAr)}</Badge>,
    },
    {
      key: 'totalDues',
      header: 'المستحق',
      render: (r) => <span className="font-bold">{formatCurrency(Number(r.totalDues))}</span>,
    },
    {
      key: 'totalPaidOut',
      header: 'المنصرف',
      render: (r) => (
        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
          {formatCurrency(Number(r.totalPaidOut))}
        </span>
      ),
    },
    {
      key: 'remainingBalance',
      header: 'المتبقي',
      render: (r) => (
        <Badge variant={Number(r.remainingBalance) > 0 ? 'warning' : 'success'}>
          {formatCurrency(Number(r.remainingBalance))}
        </Badge>
      ),
    },
  ];
}
