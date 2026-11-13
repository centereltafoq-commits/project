import { Badge, TableColumn } from '@/design-system';

type Row = Record<string, unknown>;

export function getStudentsColumns(): TableColumn<Row>[] {
  return [
    {
      key: 'studentCode',
      header: 'كود الطالب',
      render: (r) => <span className="font-mono text-xs font-bold text-primary">{String(r.studentCode)}</span>,
    },
    {
      key: 'fullName',
      header: 'اسم الطالب',
      render: (r) => <span className="font-bold text-foreground">{String(r.fullName)}</span>,
    },
    {
      key: 'phone',
      header: 'رقم الهاتف',
      render: (r) => (
        <div className="text-xs">
          <div className="font-mono font-semibold">{r.phone ? String(r.phone) : '—'}</div>
          <div className="text-muted-foreground">
            {r.guardianPhone ? `ولي الأمر: ${String(r.guardianPhone)}` : '—'}
          </div>
        </div>
      ),
    },
    {
      key: 'gradeLevel',
      header: 'المرحلة الدراسية',
      render: (r) => <span>{String(r.gradeLevel)}</span>,
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (r) => (
        <Badge
          variant={
            r.status === 'ACTIVE' ? 'success' : r.status === 'SUSPENDED' ? 'warning' : 'neutral'
          }
        >
          {String(r.statusAr)}
        </Badge>
      ),
    },
    {
      key: 'activeGroupsCount',
      header: 'المجموعات المشترك بها',
      render: (r) => (
        <Badge variant="info">{Number(r.activeGroupsCount ?? 0)} مجموعات</Badge>
      ),
    },
  ];
}

export function getAttendanceColumns(): TableColumn<Row>[] {
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
      key: 'presentCount',
      header: 'الحضور',
      render: (r) => <Badge variant="success">{Number(r.presentCount)}</Badge>,
    },
    {
      key: 'absentCount',
      header: 'الغياب',
      render: (r) => <Badge variant="danger">{Number(r.absentCount)}</Badge>,
    },
    {
      key: 'excusedCount',
      header: 'بعذر',
      render: (r) => <Badge variant="warning">{Number(r.excusedCount)}</Badge>,
    },
    {
      key: 'attendanceRate',
      header: 'نسبة الحضور',
      render: (r) => {
        const rate = Number(r.attendanceRate ?? 0);
        return (
          <Badge variant={rate >= 80 ? 'success' : rate >= 50 ? 'warning' : 'danger'}>
            {rate}%
          </Badge>
        );
      },
    },
  ];
}

export function getClassroomsColumns(): TableColumn<Row>[] {
  return [
    {
      key: 'roomNumber',
      header: 'رقم القاعة',
      render: (r) => <span className="font-mono text-xs font-bold text-primary">{String(r.roomNumber)}</span>,
    },
    {
      key: 'name',
      header: 'اسم القاعة',
      render: (r) => <span className="font-bold">{String(r.name)}</span>,
    },
    {
      key: 'maxCapacity',
      header: 'السعة القصوى',
      render: (r) => <span className="font-semibold">{Number(r.maxCapacity)} طالب</span>,
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (r) => (
        <Badge
          variant={
            r.status === 'AVAILABLE' ? 'success' : r.status === 'MAINTENANCE' ? 'warning' : 'neutral'
          }
        >
          {String(r.statusAr)}
        </Badge>
      ),
    },
    {
      key: 'sessionsCount',
      header: 'عدد الحصص بالشهر',
      render: (r) => <Badge variant="info">{Number(r.sessionsCount)} حصة</Badge>,
    },
  ];
}
