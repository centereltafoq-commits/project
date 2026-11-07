import { Badge, TableColumn } from '@/design-system';
import { formatDateAr } from '@/lib/formatters';

type Row = Record<string, unknown>;

const BOOKING_VARIANT: Record<
  string,
  'warning' | 'success' | 'danger' | 'neutral' | 'purple'
> = {
  PENDING: 'warning',
  CONFIRMED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'neutral',
  COMPLETED: 'purple',
};

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
          <div className="font-mono font-semibold">{String(r.phone)}</div>
          <div className="text-muted-foreground">ولي الأمر: {String(r.guardianPhone)}</div>
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
      key: 'makeupCount',
      header: 'التعويضي',
      render: (r) => <Badge variant="purple">{Number(r.makeupCount)}</Badge>,
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

export function getBookingsColumns(): TableColumn<Row>[] {
  return [
    {
      key: 'requestTypeAr',
      header: 'النوع',
      render: (r) => <Badge variant="info">{String(r.requestTypeAr)}</Badge>,
    },
    {
      key: 'partyLabel',
      header: 'الطالب / المدرس',
      render: (r) => <span className="font-bold">{String(r.partyLabel)}</span>,
    },
    {
      key: 'purpose',
      header: 'الغرض من الموعد',
      render: (r) => <span className="text-xs font-medium">{String(r.purpose)}</span>,
    },
    {
      key: 'dateAndTime',
      header: 'التاريخ والوقت',
      render: (r) => (
        <div className="text-xs">
          <div className="font-semibold">{formatDateAr(String(r.requestedDate))}</div>
          <div className="font-mono text-muted-foreground">{String(r.timeSlot)}</div>
        </div>
      ),
    },
    {
      key: 'classroomLabel',
      header: 'القاعة',
      render: (r) => <span className="text-xs font-semibold">{String(r.classroomLabel)}</span>,
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (r) => (
        <Badge variant={BOOKING_VARIANT[String(r.status)] || 'neutral'}>
          {String(r.statusAr)}
        </Badge>
      ),
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
    {
      key: 'confirmedBookingsCount',
      header: 'الحجوزات المعتمدة',
      render: (r) => <Badge variant="purple">{Number(r.confirmedBookingsCount)} حجز</Badge>,
    },
  ];
}
