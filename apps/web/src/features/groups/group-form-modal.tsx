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
  const { options: dynamicGradeOptions } = useGradeLevels(true);
  const gradeOptions = dynamicGradeOptions.length > 0 ? dynamicGradeOptions : GRADE_LEVEL_OPTIONS;

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

  const { data: lookupsData } = useQuery<{
    teachers: Array<{ id: string; fullName: string; specialization?: string }>;
    assistants: Array<{ id: string; fullName: string }>;
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
        gradeLevel: gradeOptions[0]?.value ?? 'الثالث الثانوي',
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
          <Select label="الصف الدراسي" searchable searchPlaceholder="ابحث في المراحل..." value={form.gradeLevel} onChange={(e) => setForm({ ...form, gradeLevel: e.target.value })} options={gradeOptions} />
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
          assistantOptions={(lookupsData?.assistants ?? []).map((a) => ({ value: a.id, label: a.fullName }))}
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
