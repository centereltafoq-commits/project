import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AssistantCalculationMethod,
  FullMonthAbsencePolicy,
  GroupRevenueSplitMethod,
  PaginatedResult,
} from '@edu-center/shared';
import { Button, Input, Modal, Select, Textarea, useToast } from '@/design-system';
import { apiClient, extractErrorMessage } from '@/lib/api-client';
import { GRADE_LEVEL_OPTIONS } from '../students/students.types';
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

  const [form, setForm] = React.useState({
    groupCode: '',
    name: '',
    subject: '',
    gradeLevel: 'الثالث الثانوي',
    primaryTeacherId: '',
    defaultClassroomId: '',
    maxStudents: '50',
    isActive: true,
    notes: '',
  });
  const [policyForm, setPolicyForm] = React.useState<GroupPolicyFormState>(DEFAULT_POLICY);
  const [slots, setSlots] = React.useState<GroupScheduleSlotItem[]>([]);
  const [assistantLinks, setAssistantLinks] = React.useState<AssistantDraftLink[]>([]);

  const { data: teachersData } = useQuery<PaginatedResult<{ id: string; fullName: string }>>({
    queryKey: ['teachers-lookup'],
    enabled: open,
    queryFn: async () => (await apiClient.get('/teachers', { params: { limit: 100 } })).data,
  });
  const { data: roomsData } = useQuery<
    PaginatedResult<{ id: string; name: string; roomNumber: string }>
  >({
    queryKey: ['classrooms-lookup'],
    enabled: open,
    queryFn: async () => (await apiClient.get('/classrooms', { params: { limit: 100 } })).data,
  });
  const { data: assistantsData } = useQuery<PaginatedResult<{ id: string; fullName: string }>>({
    queryKey: ['assistants-lookup'],
    enabled: open,
    queryFn: async () => (await apiClient.get('/assistants', { params: { limit: 100 } })).data,
  });

  React.useEffect(() => {
    if (!group) {
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

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...(isEdit ? {} : { groupCode: form.groupCode.trim() || undefined }),
        name: form.name.trim(),
        subject: form.subject.trim(),
        gradeLevel: form.gradeLevel,
        primaryTeacherId: form.primaryTeacherId,
        defaultClassroomId: form.defaultClassroomId || null,
        monthlySessionsCount: Number(policyForm.monthlySessionsCount),
        monthlyPrice: Number(policyForm.monthlyPrice),
        maxStudents: Number(form.maxStudents),
        isActive: form.isActive,
        notes: form.notes || undefined,
        scheduleSlots: slots,
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
          mutation.mutate();
        }}
        className="space-y-5"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input label="اسم المجموعة" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="المادة الدراسية" required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          <Select label="الصف الدراسي" value={form.gradeLevel} onChange={(e) => setForm({ ...form, gradeLevel: e.target.value })} options={GRADE_LEVEL_OPTIONS} />
          <Select
            label="المدرس الأساسي"
            required
            placeholder="اختر المدرس"
            value={form.primaryTeacherId}
            onChange={(e) => setForm({ ...form, primaryTeacherId: e.target.value })}
            options={(teachersData?.data ?? []).map((t) => ({ value: t.id, label: t.fullName }))}
          />
          <Select
            label="القاعة الافتراضية"
            placeholder="بدون قاعة افتراضية"
            value={form.defaultClassroomId}
            onChange={(e) => setForm({ ...form, defaultClassroomId: e.target.value })}
            options={(roomsData?.data ?? []).map((r) => ({ value: r.id, label: `${r.name} (${r.roomNumber})` }))}
          />
          <Input label="الحد الأقصى للطلاب" type="number" min={1} required value={form.maxStudents} onChange={(e) => setForm({ ...form, maxStudents: e.target.value })} />
        </div>
        <GroupFinancialPolicyFields values={policyForm} onChange={(patch) => setPolicyForm((prev) => ({ ...prev, ...patch }))} />
        <GroupScheduleAssistantsEditor
          slots={slots}
          onSlotsChange={setSlots}
          assistantLinks={assistantLinks}
          onAssistantLinksChange={setAssistantLinks}
          assistantOptions={(assistantsData?.data ?? []).map((a) => ({ value: a.id, label: a.fullName }))}
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
