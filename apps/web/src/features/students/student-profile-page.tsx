import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Edit3,
  Phone,
  RefreshCw,
  UserCheck,
  Wallet,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  Input,
  PageHeader,
  StatCard,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/design-system';
import { apiClient } from '@/lib/api-client';
import {
  formatCurrency,
  formatDateAr,
  formatYearMonthAr,
  getCurrentYearMonth,
} from '@/lib/formatters';
import { StudentFormModal } from './student-form-modal';
import {
  StudentAttendanceTab,
  StudentEnrollmentsTab,
  StudentMonthlyFinancialTab,
} from './student-academic-tabs';
import {
  StudentBookingsTab,
  StudentMakeupsTab,
  StudentPaymentsTab,
} from './student-activity-tabs';
import { STUDENT_STATUS_META, StudentProfileData } from './students.types';

export function StudentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [yearMonth, setYearMonth] = React.useState(getCurrentYearMonth());
  const [editOpen, setEditOpen] = React.useState(false);

  const { data, isLoading } = useQuery<StudentProfileData>({
    queryKey: ['student-profile', id, yearMonth],
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await apiClient.get(`/students/${id}/profile`, {
        params: { yearMonth },
      });
      return res.data;
    },
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <div className="h-24 animate-pulse rounded-xl bg-muted" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  const { student, monthTotals } = data;
  const statusMeta = STUDENT_STATUS_META[student.status] ?? {
    label: student.status,
    variant: 'neutral' as const,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={`ملف الطالب: ${student.fullName}`}
        description={`الكود الدائم: ${student.studentCode} • الصف: ${student.gradeLevel} • مسجل منذ ${formatDateAr(student.registrationDate)}`}
        actions={
          <>
            <Input
              type="month"
              value={yearMonth}
              onChange={(e) => e.target.value && setYearMonth(e.target.value)}
              className="w-44"
            />
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Edit3 className="h-4 w-4" />
              تعديل البيانات
            </Button>
            <Button variant="ghost" onClick={() => navigate('/students')}>
              <ArrowRight className="h-4 w-4" />
              قائمة الطلاب
            </Button>
          </>
        }
      />

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-6 text-sm">
            <div>
              <span className="text-muted-foreground">الحالة: </span>
              <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
            </div>
            <div className="flex items-center gap-1.5">
              <Phone className="h-4 w-4 text-primary" />
              <span className="text-muted-foreground">هاتف الطالب:</span>
              <strong dir="ltr">{student.phone}</strong>
            </div>
            <div className="flex items-center gap-1.5">
              <Phone className="h-4 w-4 text-emerald-600" />
              <span className="text-muted-foreground">هاتف ولي الأمر:</span>
              <strong dir="ltr">{student.guardianPhone}</strong>
            </div>
            {student.notes && (
              <div>
                <span className="text-muted-foreground">ملاحظات: </span>
                <span className="font-medium">{student.notes}</span>
              </div>
            )}
          </div>
          <Badge variant="purple">عرض شهر {formatYearMonthAr(yearMonth)}</Badge>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="حضور الشهر المحدد"
          value={`${monthTotals.presentCount + monthTotals.makeupCount} / ${monthTotals.totalSessions}`}
          subtitle={`غياب: ${monthTotals.absentCount} • بعذر: ${monthTotals.excusedCount}`}
          icon={UserCheck}
          tone="primary"
        />
        <StatCard
          title="إجمالي المستحق للشهر"
          value={formatCurrency(monthTotals.totalDue)}
          subtitle={`عن ${formatYearMonthAr(yearMonth)}`}
          icon={Wallet}
          tone="purple"
        />
        <StatCard
          title="المدفوع في الشهر"
          value={formatCurrency(monthTotals.totalPaid)}
          subtitle="موزع على المجموعات"
          icon={CheckCircle2}
          tone="success"
        />
        <StatCard
          title="الرصيد المتبقي"
          value={formatCurrency(monthTotals.remaining)}
          subtitle={monthTotals.remaining > 0 ? 'مستحق السداد' : 'مسدد بالكامل'}
          icon={CreditCard}
          tone={monthTotals.remaining > 0 ? 'danger' : 'success'}
        />
      </div>

      <Tabs defaultValue="monthly">
        <TabsList>
          <TabsTrigger value="monthly">
            <Wallet className="h-4 w-4" />
            السجل الشهري والحسابات
          </TabsTrigger>
          <TabsTrigger value="enrollments">
            <BookOpen className="h-4 w-4" />
            المجموعات والاشتراكات ({data.enrollments.length})
          </TabsTrigger>
          <TabsTrigger value="attendance">
            <UserCheck className="h-4 w-4" />
            سجل الحضور والغياب ({data.attendanceRecords.length})
          </TabsTrigger>
          <TabsTrigger value="payments">
            <CreditCard className="h-4 w-4" />
            المدفوعات ({data.payments.length})
          </TabsTrigger>
          <TabsTrigger value="makeups">
            <RefreshCw className="h-4 w-4" />
            الحصص التعويضية ({data.makeupSessions.length})
          </TabsTrigger>
          <TabsTrigger value="bookings">
            <CalendarClock className="h-4 w-4" />
            المواعيد والحجوزات ({data.bookings.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="monthly">
          <StudentMonthlyFinancialTab data={data} />
        </TabsContent>
        <TabsContent value="enrollments">
          <StudentEnrollmentsTab data={data} />
        </TabsContent>
        <TabsContent value="attendance">
          <StudentAttendanceTab data={data} />
        </TabsContent>
        <TabsContent value="payments">
          <StudentPaymentsTab data={data} />
        </TabsContent>
        <TabsContent value="makeups">
          <StudentMakeupsTab data={data} />
        </TabsContent>
        <TabsContent value="bookings">
          <StudentBookingsTab data={data} />
        </TabsContent>
      </Tabs>

      <StudentFormModal open={editOpen} onOpenChange={setEditOpen} student={student} />
    </div>
  );
}
