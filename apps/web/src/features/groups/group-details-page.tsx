import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Calculator,
  Calendar,
  Edit3,
  Users,
  Wallet,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
  StatCard,
} from '@/design-system';
import { apiClient } from '@/lib/api-client';
import { ARABIC_DAYS, formatCurrency } from '@/lib/formatters';
import { SPLIT_METHOD_LABELS } from '../teachers/teachers.types';
import { GroupFormModal } from './group-form-modal';
import { GroupEnrollmentsSection } from './group-enrollments-section';
import { FULL_ABSENCE_POLICY_LABELS, GroupDetailData } from './groups.types';

export function GroupDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = React.useState(false);

  const { data: group, isLoading } = useQuery<GroupDetailData>({
    queryKey: ['group-detail', id],
    enabled: Boolean(id),
    queryFn: async () => (await apiClient.get(`/groups/${id}`)).data,
  });

  if (isLoading || !group) {
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

  const pol = group.financialPolicy;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${group.name} (${group.groupCode})`}
        description={`المادة: ${group.subject} • الصف: ${group.gradeLevel} • القاعة: ${group.defaultClassroomName || 'غير محددة'}`}
        actions={
          <>
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Edit3 className="h-4 w-4" />
              تعديل الإعدادات والسياسة المالية
            </Button>
            <Button variant="ghost" onClick={() => navigate('/groups')}>
              <ArrowRight className="h-4 w-4" />
              كل المجموعات
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="الطلاب النشطون بالمجموعة"
          value={`${group.activeStudentsCount} / ${group.maxStudents}`}
          subtitle={group.isActive ? 'المجموعة مفتوحة للاشتراك' : 'المجموعة متوقفة'}
          icon={Users}
          tone="primary"
        />
        <StatCard
          title="الاشتراك الشهري"
          value={formatCurrency(group.monthlyPrice)}
          subtitle={`لعدد ${group.monthlySessionsCount} حصص بالشهر`}
          icon={Wallet}
          tone="purple"
        />
        <StatCard
          title="سعر الحصة الواحدة"
          value={formatCurrency(group.calculatedSessionPrice)}
          subtitle="محتسب تلقائياً"
          icon={Calculator}
          tone="success"
        />
        <StatCard
          title="تقسيم العائد (مدرس / سنتر)"
          value={
            pol?.revenueSplitMethod === 'CUSTOM_PERCENTAGE'
              ? `${Number(pol.teacherPercentage)}% للمدرس`
              : `${formatCurrency(pol?.teacherSharePerStudent)} / ${formatCurrency(pol?.centerSharePerStudent)}`
          }
          subtitle={
            pol ? SPLIT_METHOD_LABELS[pol.revenueSplitMethod] : 'لم تحدد سياسة'
          }
          icon={Calendar}
          tone="warning"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>المدرسون والمساعدون</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <span className="text-muted-foreground">المدرس الأساسي: </span>
              <Link
                to={`/teachers/${group.primaryTeacherId}`}
                className="font-bold text-primary hover:underline"
              >
                {group.primaryTeacherName}
              </Link>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-bold text-muted-foreground">المساعدون المرتبطون:</p>
              {group.assistants.length === 0 ? (
                <p className="text-xs text-muted-foreground">لا يوجد مساعدون مرتبطون</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {group.assistants.map((a) => (
                    <Link key={a.linkId} to={`/assistants/${a.assistantId}`}>
                      <Badge variant="purple">{a.fullName}</Badge>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>قواعد الغياب والمحاسبة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">غياب الشهر كاملاً: </span>
              <strong>
                {pol
                  ? FULL_ABSENCE_POLICY_LABELS[pol.fullMonthAbsencePolicy]
                  : 'إعفاء كامل'}
              </strong>
            </div>
            {pol?.fullMonthAbsencePolicy === 'CHARGE_FIXED_RESERVATION_FEE' && (
              <div>
                <span className="text-muted-foreground">رسوم حجز المقعد: </span>
                <strong>{formatCurrency(pol.fullAbsenceFixedFee)}</strong>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">الغياب بعذر مقبول: </span>
              <Badge variant={pol?.chargeExcusedAbsence ? 'warning' : 'success'}>
                {pol?.chargeExcusedAbsence ? 'يُحتسب على الطالب' : 'معفى من الرسوم'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>المواعيد الأسبوعية الثابتة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {group.scheduleSlots.length === 0 ? (
              <p className="text-xs text-muted-foreground">لا توجد مواعيد أسبوعية محددة</p>
            ) : (
              group.scheduleSlots.map((slot, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs"
                >
                  <span className="font-bold">{ARABIC_DAYS[slot.dayOfWeek]}</span>
                  <span className="font-mono font-semibold" dir="ltr">
                    {slot.startTime} - {slot.endTime}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <GroupEnrollmentsSection group={group} />

      <GroupFormModal open={editOpen} onOpenChange={setEditOpen} group={group} />
    </div>
  );
}
