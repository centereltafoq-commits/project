import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { PaginatedResult, PERMISSIONS, StudentStatus } from '@edu-center/shared';
import { PageHeader, useToast } from '@/design-system';
import { useAuth } from '@/features/auth/auth-context';
import { useGradeLevels } from '@/features/grade-levels/use-grade-levels';
import { GroupRow } from '@/features/groups/groups.types';
import { useCenterSettings } from '@/features/settings/center-settings-context';
import { StudentRow } from '@/features/students/students.types';
import { apiClient, extractErrorMessage } from '@/lib/api-client';
import {
  WhatsappLaunchMode,
  WhatsappTemplateVariables,
  buildWhatsAppUrl,
  normalizeWhatsAppPhone,
  openWhatsAppLink,
  renderWhatsAppTemplate,
} from '@/lib/whatsapp.util';
import {
  GroupQueueMember,
  WhatsappRecipientsPanel,
} from './components/whatsapp-recipients-panel';
import { WhatsappMessageComposer } from './components/whatsapp-message-composer';
import { WhatsappTemplateManagerModal } from './components/whatsapp-template-manager-modal';
import { whatsappTemplatesApi } from './whatsapp.api';
import {
  WhatsappMessageMode,
  WhatsappPhonePreference,
  WhatsappTargetMode,
  WhatsappTemplateItem,
} from './whatsapp.types';

const EMPTY_TEMPLATES: WhatsappTemplateItem[] = [];
const EMPTY_GROUPS: GroupRow[] = [];
const EMPTY_STUDENTS: StudentRow[] = [];

function resolveStudentPhone(
  student: Pick<StudentRow, 'phone' | 'guardianPhone'>,
  preference: WhatsappPhonePreference,
): string {
  if (preference === 'guardian') {
    return student.guardianPhone?.trim() || '';
  }
  if (preference === 'student') {
    return student.phone?.trim() || '';
  }
  return student.guardianPhone?.trim() || student.phone?.trim() || '';
}

export function WhatsappPage() {
  const [searchParams] = useSearchParams();
  const initialGroupIdParam = searchParams.get('groupId') || '';
  const initialStudentIdParam = searchParams.get('studentId') || '';
  const initialPhoneParam = searchParams.get('phone') || '';

  const { notify } = useToast();
  const { hasPermission } = useAuth();
  const { settings } = useCenterSettings();
  const queryClient = useQueryClient();
  const { options: gradeOptions } = useGradeLevels(false);

  const canManageTemplates =
    hasPermission(PERMISSIONS.STUDENTS_UPDATE) ||
    hasPermission(PERMISSIONS.GROUPS_MANAGE) ||
    hasPermission(PERMISSIONS.ATTENDANCE_RECORD) ||
    hasPermission(PERMISSIONS.SETTINGS_MANAGE);

  const [targetMode, setTargetMode] = React.useState<WhatsappTargetMode>(
    initialGroupIdParam ? 'group' : 'single',
  );
  const [messageMode, setMessageMode] = React.useState<WhatsappMessageMode>('template');
  const [selectedTemplateId, setSelectedTemplateId] = React.useState('');
  const [templateDraft, setTemplateDraft] = React.useState('');
  const [oneTimeDraft, setOneTimeDraft] = React.useState('');
  const [launchMode, setLaunchMode] = React.useState<WhatsappLaunchMode>('web');
  const [managerOpen, setManagerOpen] = React.useState(false);

  // Single target state
  const [selectedSingleStudentId, setSelectedSingleStudentId] = React.useState(
    initialStudentIdParam,
  );
  const [singlePhone, setSinglePhone] = React.useState(initialPhoneParam);
  const [singleRecipientName, setSingleRecipientName] = React.useState('');

  // Group target state
  const [gradeFilter, setGradeFilter] = React.useState('');
  const [selectedGroupId, setSelectedGroupId] = React.useState(initialGroupIdParam);
  const [phonePreference, setPhonePreference] =
    React.useState<WhatsappPhonePreference>('guardian');
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [sentIds, setSentIds] = React.useState<Set<string>>(new Set());
  const [activePreviewStudentId, setActivePreviewStudentId] = React.useState<string | null>(
    null,
  );

  // 1. Saved message templates
  const { data: templates = EMPTY_TEMPLATES, isLoading: isLoadingTemplates } = useQuery<
    WhatsappTemplateItem[]
  >({
    queryKey: ['whatsapp-templates'],
    queryFn: whatsappTemplatesApi.list,
  });

  // Select default template automatically once loaded
  React.useEffect(() => {
    if (templates.length === 0) return;
    const currentExists = selectedTemplateId && templates.some((t) => t.id === selectedTemplateId);
    if (!currentExists) {
      const def = templates.find((t) => t.isDefault) ?? templates[0]!;
      setSelectedTemplateId(def.id);
      setTemplateDraft(def.content);
    }
  }, [templates, selectedTemplateId]);

  const updateTemplateMutation = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      whatsappTemplatesApi.update(id, { content }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-templates'] });
      setTemplateDraft(updated.content);
      notify(`تم حفظ التعديلات على قالب "${updated.title}"`, 'success');
    },
    onError: (err) => notify(extractErrorMessage(err), 'error'),
  });

  const createTemplateMutation = useMutation({
    mutationFn: whatsappTemplatesApi.create,
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-templates'] });
      setMessageMode('template');
      setSelectedTemplateId(created.id);
      setTemplateDraft(created.content);
      notify(`تم حفظ القالب الجديد "${created.title}" بنجاح`, 'success');
    },
    onError: (err) => notify(extractErrorMessage(err), 'error'),
  });

  // 2. Single target student lookup list
  const { data: allStudents = EMPTY_STUDENTS, isLoading: isLoadingStudents } = useQuery<
    StudentRow[]
  >({
    queryKey: ['whatsapp-students-list'],
    enabled: targetMode === 'single' || Boolean(initialStudentIdParam),
    queryFn: async () => {
      const res = await apiClient.get<PaginatedResult<StudentRow>>('/students', {
        params: { page: 1, limit: 100, status: StudentStatus.ACTIVE },
      });
      return res.data.data ?? EMPTY_STUDENTS;
    },
  });

  // Pre-fill single student info when linked via URL (?studentId=...)
  const didApplyInitialStudentRef = React.useRef(false);
  React.useEffect(() => {
    if (didApplyInitialStudentRef.current || !initialStudentIdParam || allStudents.length === 0) {
      return;
    }
    const found = allStudents.find((s) => s.id === initialStudentIdParam);
    if (found) {
      didApplyInitialStudentRef.current = true;
      setSelectedSingleStudentId(found.id);
      setSingleRecipientName(found.fullName);
      if (!initialPhoneParam) {
        setSinglePhone(found.guardianPhone || found.phone || '');
      }
    }
  }, [allStudents, initialStudentIdParam, initialPhoneParam]);

  // 3. Groups list
  const { data: groups = EMPTY_GROUPS, isLoading: isLoadingGroups } = useQuery<GroupRow[]>({
    queryKey: ['whatsapp-groups-list'],
    enabled: targetMode === 'group' || Boolean(initialGroupIdParam),
    queryFn: async () => {
      const res = await apiClient.get<PaginatedResult<GroupRow>>('/groups', {
        params: { page: 1, limit: 100, isActive: 'true' },
      });
      return res.data.data ?? EMPTY_GROUPS;
    },
  });

  const mergedGradeOptions = React.useMemo(() => {
    const map = new Map(gradeOptions.map((o) => [o.value, o]));
    for (const g of groups) {
      if (g.gradeLevel && !map.has(g.gradeLevel)) {
        map.set(g.gradeLevel, { value: g.gradeLevel, label: g.gradeLevel });
      }
    }
    return Array.from(map.values());
  }, [gradeOptions, groups]);

  const filteredGroups = React.useMemo(() => {
    if (!gradeFilter) return groups;
    return groups.filter((g) => g.gradeLevel === gradeFilter);
  }, [groups, gradeFilter]);

  const selectedGroup = React.useMemo(
    () => groups.find((g) => g.id === selectedGroupId) ?? null,
    [groups, selectedGroupId],
  );

  // 4. Group students list
  const { data: groupStudents = EMPTY_STUDENTS, isLoading: isLoadingGroupStudents } = useQuery<
    StudentRow[]
  >({
    queryKey: ['whatsapp-group-students', selectedGroupId],
    enabled: targetMode === 'group' && Boolean(selectedGroupId),
    queryFn: async () => {
      const res = await apiClient.get<PaginatedResult<StudentRow>>('/students', {
        params: {
          page: 1,
          limit: 100,
          groupId: selectedGroupId,
          status: StudentStatus.ACTIVE,
        },
      });
      return res.data.data ?? EMPTY_STUDENTS;
    },
  });

  const groupMembers: GroupQueueMember[] = React.useMemo(
    () =>
      groupStudents.map((student) => {
        const resolvedPhone = resolveStudentPhone(student, phonePreference);
        const norm = normalizeWhatsAppPhone(resolvedPhone);
        return {
          student,
          resolvedPhone,
          normalizedDisplay: norm.display,
          hasValidPhone: norm.valid,
        };
      }),
    [groupStudents, phonePreference],
  );

  React.useEffect(() => {
    if (targetMode !== 'group' || !selectedGroupId) {
      setSelectedIds((prev) => (prev.size === 0 ? prev : new Set()));
      setSentIds((prev) => (prev.size === 0 ? prev : new Set()));
      setActivePreviewStudentId(null);
      return;
    }

    const validIds = groupMembers.filter((m) => m.hasValidPhone).map((m) => m.student.id);
    setSelectedIds(new Set(validIds));
    setSentIds(new Set());
    setActivePreviewStudentId(groupMembers[0]?.student.id ?? null);
  }, [targetMode, selectedGroupId, phonePreference, groupMembers]);

  const handleSelectSingleStudent = (studentId: string) => {
    setSelectedSingleStudentId(studentId);
    if (!studentId) return;
    const st = allStudents.find((s) => s.id === studentId);
    if (!st) return;
    setSingleRecipientName(st.fullName);
    setSinglePhone(st.guardianPhone || st.phone || '');
  };

  const handleChangeGradeFilter = (nextGrade: string) => {
    setGradeFilter(nextGrade);
    if (selectedGroupId && nextGrade && selectedGroup && selectedGroup.gradeLevel !== nextGrade) {
      setSelectedGroupId('');
    }
  };

  const activeMessageText = messageMode === 'template' ? templateDraft : oneTimeDraft;
  const handleChangeMessageText = (value: string) => {
    if (messageMode === 'template') {
      setTemplateDraft(value);
    } else {
      setOneTimeDraft(value);
    }
  };

  const singleSelectedStudent = React.useMemo(
    () => allStudents.find((s) => s.id === selectedSingleStudentId) ?? null,
    [allStudents, selectedSingleStudentId],
  );

  const previewMember = React.useMemo(
    () =>
      groupMembers.find((m) => m.student.id === activePreviewStudentId) ??
      groupMembers[0] ??
      null,
    [groupMembers, activePreviewStudentId],
  );

  const buildVariablesForStudent = React.useCallback(
    (student: Partial<StudentRow> | null, fallbackName?: string): WhatsappTemplateVariables => ({
      studentName: student?.fullName || fallbackName || '',
      studentCode: student?.studentCode || '',
      gradeLevel: student?.gradeLevel || selectedGroup?.gradeLevel || '',
      groupName: selectedGroup?.name || '',
      subject: selectedGroup?.subject || '',
      teacherName: selectedGroup?.primaryTeacherName || '',
      centerName: settings.centerName || '',
      date: new Date().toISOString().slice(0, 10),
    }),
    [selectedGroup, settings.centerName],
  );

  const previewVars = React.useMemo(() => {
    if (targetMode === 'group') {
      return buildVariablesForStudent(previewMember?.student ?? null);
    }
    return {
      studentName: singleRecipientName || singleSelectedStudent?.fullName || '',
      studentCode: singleSelectedStudent?.studentCode || '',
      gradeLevel: singleSelectedStudent?.gradeLevel || '',
      groupName: '',
      subject: '',
      teacherName: '',
      centerName: settings.centerName || '',
      date: new Date().toISOString().slice(0, 10),
    };
  }, [
    targetMode,
    buildVariablesForStudent,
    previewMember,
    singleRecipientName,
    singleSelectedStudent,
    settings.centerName,
  ]);

  const launchWhatsAppFor = async (
    rawPhone: string,
    vars: WhatsappTemplateVariables,
    recipientLabel: string,
  ): Promise<boolean> => {
    const renderedText = renderWhatsAppTemplate(activeMessageText, vars);
    if (!renderedText) {
      notify('يرجى كتابة نص الرسالة أولاً قبل الإرسال', 'error');
      return false;
    }

    const url = buildWhatsAppUrl(rawPhone, renderedText, launchMode);
    if (!url) {
      notify(`رقم الهاتف الخاص بـ "${recipientLabel}" غير صالح للواتساب`, 'error');
      return false;
    }

    const res = await openWhatsAppLink(url);
    if (!res.success) {
      notify(res.error, 'error');
      return false;
    }

    notify(`تم فتح محادثة واتساب لـ ${recipientLabel}`, 'success');
    return true;
  };

  const handleSendSingle = () => {
    void launchWhatsAppFor(
      singlePhone,
      previewVars,
      singleRecipientName || singlePhone,
    );
  };

  const handleSendGroupMember = async (member: GroupQueueMember) => {
    setActivePreviewStudentId(member.student.id);
    const ok = await launchWhatsAppFor(
      member.resolvedPhone,
      buildVariablesForStudent(member.student),
      member.student.fullName,
    );
    if (ok) {
      setSentIds((prev) => new Set(prev).add(member.student.id));
    }
  };

  const handleSendNextGroupMember = () => {
    const nextMember = groupMembers.find(
      (m) =>
        selectedIds.has(m.student.id) &&
        m.hasValidPhone &&
        !sentIds.has(m.student.id),
    );
    if (!nextMember) {
      notify('تم فتح واتساب لجميع الطلاب المحددين في هذه المجموعة', 'success');
      return;
    }
    void handleSendGroupMember(nextMember);
  };

  const handleToggleStudent = (studentId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  };

  const handleToggleAllGroupStudents = () => {
    const allChecked =
      groupMembers.length > 0 && groupMembers.every((m) => selectedIds.has(m.student.id));
    if (allChecked) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(groupMembers.filter((m) => m.hasValidPhone).map((m) => m.student.id)));
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="رسائل واتساب"
        description="إرسال رسائل واتساب مباشرة لأي رقم أو لمجموعة طلاب كاملة عبر WhatsApp Web باستخدام القوالب المحفوظة أو رسائل فورية مرة واحدة"
        actions={
          <div className="hidden sm:flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
            <MessageCircle className="h-4 w-4" />
            ربط مباشر مع WhatsApp Web
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-start">
        <div className="lg:col-span-5">
          <WhatsappRecipientsPanel
            targetMode={targetMode}
            onChangeTargetMode={setTargetMode}
            allStudents={allStudents}
            isLoadingStudents={isLoadingStudents}
            selectedSingleStudentId={selectedSingleStudentId}
            onSelectSingleStudent={handleSelectSingleStudent}
            singlePhone={singlePhone}
            onChangeSinglePhone={setSinglePhone}
            singleRecipientName={singleRecipientName}
            onChangeSingleRecipientName={setSingleRecipientName}
            onSendSingle={handleSendSingle}
            gradeFilter={gradeFilter}
            onChangeGradeFilter={handleChangeGradeFilter}
            gradeOptions={mergedGradeOptions}
            groups={filteredGroups}
            isLoadingGroups={isLoadingGroups}
            selectedGroupId={selectedGroupId}
            onSelectGroupId={setSelectedGroupId}
            phonePreference={phonePreference}
            onChangePhonePreference={setPhonePreference}
            groupMembers={groupMembers}
            isLoadingGroupStudents={isLoadingGroupStudents}
            selectedIds={selectedIds}
            onToggleStudent={handleToggleStudent}
            onToggleAllGroupStudents={handleToggleAllGroupStudents}
            sentIds={sentIds}
            activePreviewStudentId={activePreviewStudentId}
            onPreviewStudent={setActivePreviewStudentId}
            onSendGroupMember={handleSendGroupMember}
            onSendNextGroupMember={handleSendNextGroupMember}
            onResetSentQueue={() => setSentIds(new Set())}
            hasMessageContent={activeMessageText.trim().length > 0}
          />
        </div>

        <div className="lg:col-span-7">
          <WhatsappMessageComposer
            templates={templates}
            isLoadingTemplates={isLoadingTemplates}
            messageMode={messageMode}
            onChangeMessageMode={setMessageMode}
            selectedTemplateId={selectedTemplateId}
            onSelectTemplate={(tpl) => {
              setSelectedTemplateId(tpl.id);
              setTemplateDraft(tpl.content);
            }}
            messageText={activeMessageText}
            onChangeMessageText={handleChangeMessageText}
            launchMode={launchMode}
            onChangeLaunchMode={setLaunchMode}
            previewVars={previewVars}
            canManageTemplates={canManageTemplates}
            onSaveTemplateEdit={(id, content) =>
              updateTemplateMutation.mutate({ id, content })
            }
            isSavingTemplate={updateTemplateMutation.isPending}
            onCreateTemplate={(payload) => createTemplateMutation.mutate(payload)}
            isCreatingTemplate={createTemplateMutation.isPending}
            onOpenTemplateManager={() => setManagerOpen(true)}
          />
        </div>
      </div>

      {managerOpen && (
        <WhatsappTemplateManagerModal
          open={managerOpen}
          onOpenChange={setManagerOpen}
          templates={templates}
          canManage={canManageTemplates}
          onSelectTemplate={(tpl) => {
            setMessageMode('template');
            setSelectedTemplateId(tpl.id);
            setTemplateDraft(tpl.content);
          }}
        />
      )}
    </div>
  );
}
