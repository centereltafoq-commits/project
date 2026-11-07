import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  Clock,
  CreditCard,
  Edit3,
  Phone,
  Wallet,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  Input,
  MonthPicker,
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
import { TeacherFormModal } from './teacher-form-modal';
import { TeacherAvailabilityTab } from './teacher-availability-tab';
import {
  TeacherBookingsTab,
  TeacherGroupsAndScheduleTab,
  TeacherMonthlySummaryTab,
  TeacherPayoutsTab,
} from './teacher-profile-tabs';
import { TEACHER_STATUS_META, TeacherProfileData } from './teachers.types';

export function TeacherProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [yearMonth, setYearMonth] = React.useState(getCurrentYearMonth());
  const [editOpen, setEditOpen] = React.useState(false);

  const { data, isLoading } = useQuery<TeacherProfileData>({
    queryKey: ['teacher-profile', id, yearMonth],
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await apiClient.get(`/teachers/${id}/profile`, {
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

  const { teacher, monthlyBreakdown } = data;
  const { totals } = monthlyBreakdown;
  const statusMeta = TEACHER_STATUS_META[teacher.employmentStatus] ?? {
    label: teacher.employmentStatus,
    variant: 'success' as const,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={`ملف المدرس: ${teacher.fullName}`}
        description={`الكود: ${teacher.teacherCode} • التخصص: ${teacher.specialization} • متعاقد منذ ${formatDateAr(teacher.contractDate)}`}
        actions={
          <>
            <MonthPicker
              value={yearMonth}
              onChange={setYearMonth}
            />
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Edit3 className="h-4 w-4" />
              تعديل البيانات
            </Button>
            <Button variant="ghost" onClick={() => navigate('/teachers')}>
              <ArrowRight className="h-4 w-4" />
              قائمة المدرسين
            </Button>
          </>
        }
      />

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <span className="text-muted-foreground">الحالة: </span>
              <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
            </div>
            <div className="flex items-center gap-1.5">
              <Phone className="h-4 w-4 text-primary" />
              <span className="text-muted-foreground">الهاتف:</span>
              <strong dir="ltr">{teacher.phone}</strong>
            </div>
            <div>
              <span className="text-muted-foreground">اعتماد المواعيد: </span>
              <Badge variant={teacher.canApproveBookings ? 'success' : 'neutral'}>
                {teacher.canApproveBookings ? 'مفعل للمدرس' : 'إدارة السنتر فقط'}
              </Badge>
            </div>
          </div>
          <Badge variant="purple">مستحقات شهر {formatYearMonthAr(yearMonth)}</Badge>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="المجموعات والحصص المنفذة"
          value={`${totals.executedSessionsCount} حصة`}
          subtitle={`في ${totals.groupsCount} مجموعات نشطة`}
          icon={BookOpen}
          tone="primary"
        />
        <StatCard
          title="إجمالي مستحقات الشهر"
          value={formatCurrency(totals.totalDues)}
          subtitle={`شهر ${formatYearMonthAr(yearMonth)}`}
          icon={Wallet}
          tone="purple"
        />
        <StatCard
          title="إجمالي المنصرف للمدرس"
          value={formatCurrency(totals.totalPayouts)}
          subtitle="دفعات مسجلة بالخزينة"
          icon={CreditCard}
          tone="success"
        />
        <StatCard
          title="الرصيد المتبقي للمدرس"
          value={formatCurrency(totals.remainingBalance)}
          subtitle={totals.remainingBalance > 0 ? 'مستحق الصرف' : 'تمت التصفية'}
          icon={Wallet}
          tone={totals.remainingBalance > 0 ? 'warning' : 'success'}
        />
      </div>

      <Tabs defaultValue="summary">
        <TabsList>
          <TabsTrigger value="summary">
            <Wallet className="h-4 w-4" />
            الملخص الشهري والمستحقات
          </TabsTrigger>
          <TabsTrigger value="groups">
            <BookOpen className="h-4 w-4" />
            المجموعات والجدول ({data.assignedGroups.length})
          </TabsTrigger>
          <TabsTrigger value="availability">
            <Clock className="h-4 w-4" />
            أوقات الإتاحة ({data.availability.length})
          </TabsTrigger>
          <TabsTrigger value="payouts">
            <CreditCard className="h-4 w-4" />
            عمليات الصرف ({data.payouts.length})
          </TabsTrigger>
          <TabsTrigger value="bookings">
            <CalendarClock className="h-4 w-4" />
            الحجوزات ({data.bookings.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary">
          <TeacherMonthlySummaryTab data={data} />
        </TabsContent>
        <TabsContent value="groups">
          <TeacherGroupsAndScheduleTab data={data} />
        </TabsContent>
        <TabsContent value="availability">
          <TeacherAvailabilityTab teacherId={teacher.id} initialSlots={data.availability} />
        </TabsContent>
        <TabsContent value="payouts">
          <TeacherPayoutsTab data={data} />
        </TabsContent>
        <TabsContent value="bookings">
          <TeacherBookingsTab data={data} />
        </TabsContent>
      </Tabs>

      <TeacherFormModal open={editOpen} onOpenChange={setEditOpen} teacher={teacher} />
    </div>
  );
}
