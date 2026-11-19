import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2 } from 'lucide-react';
import {
  AssistantCalculationMethod,
  FullMonthAbsencePolicy,
  GroupRevenueSplitMethod,
} from '@edu-center/shared';
import { Badge, Button, Input, Modal, Select, Textarea, useToast } from '@/design-system';
import { apiClient, extractErrorMessage } from '@/lib/api-client';
import { useGradeLevels } from '../grade-levels/use-grade-levels';
import {
  GroupFinancialPolicyFields,
  GroupPolicyFormState,
} from './group-financial-policy-fields';
import {
  AssistantDraftLink,
  GroupScheduleAssistantsEditor,
} from './group-schedule-assistants-editor';
import { GroupDetailData, GroupScheduleSlotItem } from './groups.types';

interface GroupFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group?: GroupDetailData | null;
}

const DEFAULT_POLICY: GroupPolicyFormState = {
  monthlySessionsCount: '8',
  monthlyPrice: '320',
  revenueSplitMethod: GroupRevenueSplitMethod.ACTUAL_ATTENDANCE_RATIO,
  teacherSharePerStudent: '240',
  centerSharePerStudent: '80',
  teacherPercentage: '75',
  fullMonthAbsencePolicy: FullMonthAbsencePolicy.EXEMPT_FULL_ABSENCE,
  fullAbsenceFixedFee: '0',
  chargeExcusedAbsence: false,
};

export function GroupFormModal({ open, onOpenChange, group }: GroupFormModalProps) {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const isEdit = Boolean(group);
  const { gradeLevels: allGradeLevels, isLoading: isLoadingGrades } = useGradeLevels(false);
  const activeGradeOptions = React.useMemo(
    () =>
      allGradeLevels
        .filter((g) => g.isActive)
        .map((g) => ({ value: g.name, label: g.name })),
    [allGradeLevels],
  );

  const gradeOptions = React.useMemo(() => {
    const currentGrade = group?.gradeLevel;
    if (!currentGrade || activeGradeOptions.some((o) => o.value === currentGrade)) {
      return activeGradeOptions;
    }
    const matchedAll = allGradeLevels.find((g) => g.name === currentGrade);
    return [
      {
        value: currentGrade,
        label: matchedAll ? `${currentGrade} (غير مفعّل)` : `${currentGrade} (سجل سابق)`,
      },
      ...activeGradeOptions,
    ];
  }, [activeGradeOptions, allGradeLevels, group?.gradeLevel]);

  const defaultGrade = activeGradeOptions[0]?.value ?? '';

  const [form, setForm] = React.useState({
    groupCode: '',
    name: '',
    subject: '',
    gradeLevel: '',
    primaryTeacherId: '',
    defaultClassroomId: '',
    maxStudents: '50',
    isActive: true,
    notes: '',
  });
  const [policyForm, setPolicyForm] = React.useState<GroupPolicyFormState>(DEFAULT_POLICY);
  const [slots, setSlots] = React.useState<GroupScheduleSlotItem[]>([]);
  const [assistantLinks, setAssistantLinks] = React.useState<AssistantDraftLink[]>([]);

  const { data: lookupsData } = useQuery<{
    teachers: Array<{ id: string; fullName: string; specialization?: string }>;
    assistants: Array<{
      id: string;
      fullName: string;
      calculationMethod?: string;
      rateValue?: string;
    }>;
  }>({
    queryKey: ['groups-lookups'],
    enabled: open,
    queryFn: async () => (await apiClient.get('/groups/lookups')).data,
  });

  React.useEffect(() => {
    if (!group) {
      setForm({
        groupCode: '',
        name: '',
        subject: '',
        gradeLevel: defaultGrade,
        primaryTeacherId: '',
        defaultClassroomId: '',
        maxStudents: '50',
        isActive: true,
        notes: '',
      });
      setPolicyForm(DEFAULT_POLICY);
      setSlots([]);
      setAssistantLinks([]);
      return;
    }
    const pol = group.financialPolicy;
    setForm({
      groupCode: group.groupCode,
      name: group.name,
      subject: group.subject,
      gradeLevel: group.gradeLevel,
      primaryTeacherId: group.primaryTeacherId,
      defaultClassroomId: group.defaultClassroomId ?? '',
      maxStudents: String(group.maxStudents),
      isActive: group.isActive,
      notes: group.notes ?? '',
    });
    setPolicyForm({
      monthlySessionsCount: String(group.monthlySessionsCount),
      monthlyPrice: String(group.monthlyPrice),
      revenueSplitMethod: pol?.revenueSplitMethod ?? DEFAULT_POLICY.revenueSplitMethod,
      teacherSharePerStudent: String(pol?.teacherSharePerStudent ?? '0'),
      centerSharePerStudent: String(pol?.centerSharePerStudent ?? '0'),
      teacherPercentage: String(pol?.teacherPercentage ?? '0'),
      fullMonthAbsencePolicy: pol?.fullMonthAbsencePolicy ?? DEFAULT_POLICY.fullMonthAbsencePolicy,
      fullAbsenceFixedFee: String(pol?.fullAbsenceFixedFee ?? '0'),
      chargeExcusedAbsence: pol?.chargeExcusedAbsence ?? false,
    });
    setSlots(group.scheduleSlots ?? []);
    setAssistantLinks(
      (group.assistants ?? []).map((a) => ({
        assistantId: a.assistantId,
        overrideCalculationMethod: a.overrideCalculationMethod ?? '',
        overrideRateValue: a.overrideRateValue ?? '',
      })),
    );
  }, [group, open]);

  React.useEffect(() => {
    if (!group && open && !form.gradeLevel && defaultGrade) {
      setForm((prev) => ({ ...prev, gradeLevel: defaultGrade }));
    }
  }, [group, open, defaultGrade, form.gradeLevel]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...(isEdit ? {} : { groupCode: form.groupCode.trim() || undefined }),
        name: form.name.trim(),
        subject: form.subject.trim(),
        gradeLevel: form.gradeLevel,
        primaryTeacherId: form.primaryTeacherId,
        defaultClassroomId: isEdit ? group?.defaultClassroomId ?? null : null,
        monthlySessionsCount: Number(policyForm.monthlySessionsCount),
        monthlyPrice: Number(policyForm.monthlyPrice),
        maxStudents: Number(form.maxStudents),
        isActive: form.isActive,
        notes: form.notes || undefined,
        scheduleSlots: slots.map((s) => ({
          dayOfWeek: Number(s.dayOfWeek),
          startTime: s.startTime.slice(0, 5),
          endTime: s.endTime.slice(0, 5),
          classroomId: isEdit ? s.classroomId ?? null : null,
        })),
        financialPolicy: {
          revenueSplitMethod: policyForm.revenueSplitMethod,
          teacherSharePerStudent: Number(policyForm.teacherSharePerStudent || 0),
          centerSharePerStudent: Number(policyForm.centerSharePerStudent || 0),
          teacherPercentage: Number(policyForm.teacherPercentage || 0),
          fullMonthAbsencePolicy: policyForm.fullMonthAbsencePolicy,
          fullAbsenceFixedFee: Number(policyForm.fullAbsenceFixedFee || 0),
          chargeExcusedAbsence: policyForm.chargeExcusedAbsence,
        },
        assistants: assistantLinks
          .filter((l) => l.assistantId)
          .map((l) => ({
            assistantId: l.assistantId,
            overrideCalculationMethod:
              (l.overrideCalculationMethod as AssistantCalculationMethod) || undefined,
            overrideRateValue: l.overrideRateValue ? Number(l.overrideRateValue) : undefined,
          })),
      };
      return isEdit && group
        ? apiClient.patch(`/groups/${group.id}`, payload)
        : apiClient.post('/groups', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['groups-lookups'] });
      queryClient.invalidateQueries({ queryKey: ['classroom-unallocated-groups'] });
      queryClient.invalidateQueries({ queryKey: ['classroom-allocated-groups'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['finance'] });
      queryClient.invalidateQueries({ queryKey: ['student-profile'] });
      queryClient.invalidateQueries({ queryKey: ['teacher-profile'] });
      queryClient.invalidateQueries({ queryKey: ['assistant-profile'] });
      if (group) queryClient.invalidateQueries({ queryKey: ['group-detail', group.id] });
      notify(isEdit ? 'تم تحديث بيانات المجموعة والسياسة المالية' : 'تم إنشاء المجموعة بنجاح');
      onOpenChange(false);
    },
    onError: (err) => notify(extractErrorMessage(err), 'error'),
  });

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      title={isEdit ? 'تعديل إعدادات المجموعة والسياسة المالية' : 'إنشاء مجموعة دراسية جديدة'}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.gradeLevel.trim()) {
            notify('يرجى إضافة صف دراسي وتحديده أولاً من «إدارة الصفوف الدراسية»', 'error');
            return;
          }
          const monthlyPrice = Number(policyForm.monthlyPrice || 0);
          const teacherShare = Number(policyForm.teacherSharePerStudent || 0);
          const centerShare = Number(policyForm.centerSharePerStudent || 0);
          if (
            (policyForm.revenueSplitMethod === GroupRevenueSplitMethod.ACTUAL_ATTENDANCE_RATIO ||
              policyForm.revenueSplitMethod === GroupRevenueSplitMethod.FIXED_PER_STUDENT) &&
            teacherShare + centerShare > monthlyPrice + 0.001
          ) {
            notify(
              `مجموع نصيب المدرس والسنتر (${teacherShare + centerShare} ج.م) لا يمكن أن يتجاوز الاشتراك الشهري للطالب (${monthlyPrice} ج.م)`,
              'error',
            );
            return;
          }
          if (
            policyForm.revenueSplitMethod === GroupRevenueSplitMethod.CUSTOM_PERCENTAGE &&
            (Number(policyForm.teacherPercentage || 0) < 0 ||
              Number(policyForm.teacherPercentage || 0) > 100)
          ) {
            notify('نسبة المدرس المئوية يجب أن تكون بين 0% و 100%', 'error');
            return;
          }
          if (
            policyForm.fullMonthAbsencePolicy ===
              FullMonthAbsencePolicy.CHARGE_FIXED_RESERVATION_FEE &&
            Number(policyForm.fullAbsenceFixedFee || 0) > monthlyPrice + 0.001
          ) {
            notify('رسوم حجز المقعد لا يمكن أن تتجاوز قيمة الاشتراك الشهري', 'error');
            return;
          }
          for (const lnk of assistantLinks.filter((l) => l.assistantId)) {
            const asst = lookupsData?.assistants.find((a) => a.id === lnk.assistantId);
            const effectiveMethod = lnk.overrideCalculationMethod || asst?.calculationMethod;
            const effectiveRate = lnk.overrideRateValue
              ? Number(lnk.overrideRateValue)
              : Number(asst?.rateValue || 0);
            if (
              effectiveMethod === AssistantCalculationMethod.SESSION_COMMISSION_PERCENT &&
              effectiveRate > 100
            ) {
              notify('نسبة عمولة المساعد لا يمكن أن تتجاوز 100%', 'error');
              return;
            }
          }
          mutation.mutate();
        }}
        className="space-y-5"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input label="اسم المجموعة" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="المادة الدراسية" required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          <Select
            label="الصف الدراسي"
            required
            searchable
            placeholder={
              gradeOptions.length === 0
                ? 'لا توجد صفوف دراسية مسجلة'
                : 'اختر الصف الدراسي...'
            }
            searchPlaceholder="ابحث في المراحل..."
            emptyText="لا توجد صفوف دراسية مفعّلة. أضف صفاً من «إدارة الصفوف الدراسية» أولاً."
            error={
              !isLoadingGrades && gradeOptions.length === 0
                ? 'لا توجد صفوف دراسية مفعّلة حالياً. أضف صفاً من «إدارة الصفوف الدراسية» أولاً.'
                : undefined
            }
            value={form.gradeLevel}
            onChange={(e) => setForm({ ...form, gradeLevel: e.target.value })}
            options={gradeOptions}
          />
          <Select
            label="المدرس الأساسي"
            required
            searchable
            searchPlaceholder="ابحث باسم المدرس..."
            placeholder="اختر المدرس"
            value={form.primaryTeacherId}
            onChange={(e) => setForm({ ...form, primaryTeacherId: e.target.value })}
            options={(lookupsData?.teachers ?? []).map((t) => ({ value: t.id, label: t.fullName }))}
          />
          <Input label="الحد الأقصى للطلاب" type="number" min={1} required value={form.maxStudents} onChange={(e) => setForm({ ...form, maxStudents: e.target.value })} />
          <div className="flex flex-col justify-end">
            <div className="flex h-10 items-center justify-between rounded-xl border border-primary/25 bg-primary/5 px-3 text-xs">
              <span className="flex items-center gap-1.5 font-semibold text-foreground">
                <Building2 className="h-3.5 w-3.5 text-primary" />
                القاعة والتسكين:
              </span>
              {isEdit && group?.defaultClassroomName ? (
                <Badge variant="info">{group.defaultClassroomName}</Badge>
              ) : (
                <span className="text-muted-foreground">تُنظم يدوياً من «إدارة القاعات»</span>
              )}
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-3.5 py-2.5 text-xs text-muted-foreground">
          ملاحظة التنظيم: لا يتم إسناد قاعة تلقائياً عند إنشاء المجموعة؛ بعد الحفظ يتم تسكين المجموعة وتنظيم مواعيدها في القاعة المناسبة من شاشة <strong className="text-foreground">إدارة القاعات</strong>.
        </div>
        <GroupFinancialPolicyFields values={policyForm} onChange={(patch) => setPolicyForm((prev) => ({ ...prev, ...patch }))} />
        <GroupScheduleAssistantsEditor
          slots={slots}
          onSlotsChange={setSlots}
          assistantLinks={assistantLinks}
          onAssistantLinksChange={setAssistantLinks}
          assistantOptions={(lookupsData?.assistants ?? []).map((a) => ({
            value: a.id,
            label: a.fullName,
            calculationMethod: a.calculationMethod,
            rateValue: a.rateValue,
          }))}
        />
        <Textarea label="ملاحظات المجموعة" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button type="submit" isLoading={mutation.isPending}>{isEdit ? 'حفظ تعديلات المجموعة' : 'إنشاء المجموعة'}</Button>
        </div>
      </form>
    </Modal>
  );
}
