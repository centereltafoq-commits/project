import * as React from 'react';
import {
  CheckCircle2,
  CheckSquare,
  Loader2,
  Phone,
  RotateCcw,
  Search,
  Send,
  Square,
  User,
  Users,
} from 'lucide-react';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Select } from '@/design-system';
import { GroupRow } from '@/features/groups/groups.types';
import { StudentRow } from '@/features/students/students.types';
import { normalizeWhatsAppPhone } from '@/lib/whatsapp.util';
import {
  WhatsappPhonePreference,
  WhatsappTargetMode,
} from '../whatsapp.types';

export interface GroupQueueMember {
  student: StudentRow;
  resolvedPhone: string;
  normalizedDisplay: string;
  hasValidPhone: boolean;
}

interface WhatsappRecipientsPanelProps {
  targetMode: WhatsappTargetMode;
  onChangeTargetMode: (mode: WhatsappTargetMode) => void;
  // Single target props
  allStudents: StudentRow[];
  isLoadingStudents: boolean;
  selectedSingleStudentId: string;
  onSelectSingleStudent: (studentId: string) => void;
  singlePhone: string;
  onChangeSinglePhone: (value: string) => void;
  singleRecipientName: string;
  onChangeSingleRecipientName: (value: string) => void;
  onSendSingle: () => void;
  // Group target props
  gradeFilter: string;
  onChangeGradeFilter: (grade: string) => void;
  gradeOptions: Array<{ value: string; label: string }>;
  groups: GroupRow[];
  isLoadingGroups: boolean;
  selectedGroupId: string;
  onSelectGroupId: (groupId: string) => void;
  phonePreference: WhatsappPhonePreference;
  onChangePhonePreference: (pref: WhatsappPhonePreference) => void;
  groupMembers: GroupQueueMember[];
  isLoadingGroupStudents: boolean;
  selectedIds: Set<string>;
  onToggleStudent: (studentId: string) => void;
  onToggleAllGroupStudents: () => void;
  sentIds: Set<string>;
  activePreviewStudentId: string | null;
  onPreviewStudent: (studentId: string) => void;
  onSendGroupMember: (member: GroupQueueMember) => void;
  onSendNextGroupMember: () => void;
  onResetSentQueue: () => void;
  hasMessageContent: boolean;
}

const PHONE_PREF_OPTIONS: Array<{ value: WhatsappPhonePreference; label: string }> = [
  { value: 'guardian', label: 'هاتف ولي الأمر' },
  { value: 'student', label: 'هاتف الطالب' },
  { value: 'auto', label: 'تلقائي (ولي الأمر أولاً)' },
];

export function WhatsappRecipientsPanel({
  targetMode,
  onChangeTargetMode,
  allStudents,
  isLoadingStudents,
  selectedSingleStudentId,
  onSelectSingleStudent,
  singlePhone,
  onChangeSinglePhone,
  singleRecipientName,
  onChangeSingleRecipientName,
  onSendSingle,
  gradeFilter,
  onChangeGradeFilter,
  gradeOptions,
  groups,
  isLoadingGroups,
  selectedGroupId,
  onSelectGroupId,
  phonePreference,
  onChangePhonePreference,
  groupMembers,
  isLoadingGroupStudents,
  selectedIds,
  onToggleStudent,
  onToggleAllGroupStudents,
  sentIds,
  activePreviewStudentId,
  onPreviewStudent,
  onSendGroupMember,
  onSendNextGroupMember,
  onResetSentQueue,
  hasMessageContent,
}: WhatsappRecipientsPanelProps) {
  const [groupSearch, setGroupSearch] = React.useState('');

  const studentOptions = React.useMemo(
    () =>
      allStudents.map((s) => ({
        value: s.id,
        label: `${s.fullName} (${s.studentCode})`,
        sublabel: `${s.gradeLevel}${s.guardianPhone ? ` • ولي الأمر: ${s.guardianPhone}` : s.phone ? ` • هاتف: ${s.phone}` : ''}`,
      })),
    [allStudents],
  );

  const selectedSingleStudent = React.useMemo(
    () => allStudents.find((s) => s.id === selectedSingleStudentId) ?? null,
    [allStudents, selectedSingleStudentId],
  );

  const singlePhoneMeta = React.useMemo(
    () => normalizeWhatsAppPhone(singlePhone),
    [singlePhone],
  );

  const groupOptions = React.useMemo(
    () =>
      groups.map((g) => ({
        value: g.id,
        label: `${g.name} (${g.groupCode})`,
        sublabel: `${g.gradeLevel} • ${g.subject} • ${g.activeStudentsCount} طالب`,
      })),
    [groups],
  );

  const filteredGroupMembers = React.useMemo(() => {
    const term = groupSearch.trim().toLowerCase();
    if (!term) return groupMembers;
    return groupMembers.filter(
      (m) =>
        m.student.fullName.toLowerCase().includes(term) ||
        m.student.studentCode.toLowerCase().includes(term) ||
        m.resolvedPhone.toLowerCase().includes(term),
    );
  }, [groupMembers, groupSearch]);

  const sendableSelectedMembers = React.useMemo(
    () => groupMembers.filter((m) => selectedIds.has(m.student.id) && m.hasValidPhone),
    [groupMembers, selectedIds],
  );

  const remainingToSendCount = React.useMemo(
    () => sendableSelectedMembers.filter((m) => !sentIds.has(m.student.id)).length,
    [sendableSelectedMembers, sentIds],
  );

  const sentCount = sendableSelectedMembers.length - remainingToSendCount;
  const allGroupChecked =
    groupMembers.length > 0 &&
    groupMembers.every((m) => selectedIds.has(m.student.id));

  return (
    <Card>
      <CardHeader className="space-y-3 border-b border-border pb-3.5">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4.5 w-4.5 text-emerald-600" />
          تحديد المستلم (رقم أو مجموعة)
        </CardTitle>

        <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/40 p-1">
          <button
            type="button"
            onClick={() => onChangeTargetMode('single')}
            className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-all ${
              targetMode === 'single'
                ? 'bg-card text-primary shadow-xs ring-1 ring-border'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <User className="h-3.5 w-3.5" />
            <span>رقم أو طالب معين</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeTargetMode('group')}
            className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-all ${
              targetMode === 'group'
                ? 'bg-card text-primary shadow-xs ring-1 ring-border'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>مجموعة معينة</span>
          </button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-4">
        {targetMode === 'single' ? (
          <div className="space-y-3.5">
            <Select
              label="اختيار طالب مسجل (اختياري)"
              placeholder={isLoadingStudents ? 'جاري تحميل الطلاب...' : 'ابحث بالاسم أو الكود...'}
              searchPlaceholder="ابحث باسم الطالب أو الكود أو الهاتف..."
              emptyText="لا يوجد طلاب مطابقون"
              clearable
              searchable
              value={selectedSingleStudentId}
              onChange={(e) => onSelectSingleStudent(e.target.value)}
              options={studentOptions}
            />

            {selectedSingleStudent && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/20 p-2.5 text-xs">
                <span className="font-bold text-muted-foreground">أرقام الطالب السريعة:</span>
                {selectedSingleStudent.guardianPhone && (
                  <button
                    type="button"
                    onClick={() => onChangeSinglePhone(selectedSingleStudent.guardianPhone || '')}
                    className={`rounded-lg border px-2.5 py-1 font-mono text-[11px] font-bold transition-colors ${
                      singlePhone === selectedSingleStudent.guardianPhone
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card text-foreground hover:border-primary/50'
                    }`}
                  >
                    ولي الأمر: {selectedSingleStudent.guardianPhone}
                  </button>
                )}
                {selectedSingleStudent.phone && (
                  <button
                    type="button"
                    onClick={() => onChangeSinglePhone(selectedSingleStudent.phone || '')}
                    className={`rounded-lg border px-2.5 py-1 font-mono text-[11px] font-bold transition-colors ${
                      singlePhone === selectedSingleStudent.phone
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card text-foreground hover:border-primary/50'
                    }`}
                  >
                    الطالب: {selectedSingleStudent.phone}
                  </button>
                )}
                {!selectedSingleStudent.guardianPhone && !selectedSingleStudent.phone && (
                  <span className="text-[11px] text-amber-600">
                    لا يوجد رقم مسجل لهذا الطالب، يمكنك كتابته يدوياً بالأسفل.
                  </span>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-semibold text-foreground">
                  رقم الواتساب المستهدف
                </label>
                {singlePhone.trim() && (
                  <Badge variant={singlePhoneMeta.valid ? 'success' : 'danger'} className="font-mono text-[10px]">
                    {singlePhoneMeta.valid ? singlePhoneMeta.display : 'رقم غير صالح'}
                  </Badge>
                )}
              </div>
              <Input
                dir="ltr"
                value={singlePhone}
                onChange={(e) => onChangeSinglePhone(e.target.value)}
                placeholder="مثال: 01012345678 أو +201012345678"
              />
            </div>

            <Input
              label="اسم المستلم للمعاينة والمتغيرات (اختياري)"
              value={singleRecipientName}
              onChange={(e) => onChangeSingleRecipientName(e.target.value)}
              placeholder="مثال: أحمد محمد"
            />

            <Button
              type="button"
              size="lg"
              onClick={onSendSingle}
              disabled={!singlePhoneMeta.valid || !hasMessageContent}
              className="w-full gap-2 bg-emerald-600 text-white hover:bg-emerald-700 font-black"
            >
              <Send className="h-4 w-4" />
              <span>فتح واتساب وإرسال الرسالة الآن</span>
            </Button>
          </div>
        ) : (
          <div className="space-y-3.5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select
                label="تصفية حسب الصف الدراسي (اختياري)"
                placeholder="كل الصفوف الدراسية"
                clearable
                searchable
                value={gradeFilter}
                onChange={(e) => onChangeGradeFilter(e.target.value)}
                options={gradeOptions}
              />

              <Select
                label="المجموعة المختارة"
                placeholder={isLoadingGroups ? 'جاري تحميل المجموعات...' : 'اختر المجموعة...'}
                searchPlaceholder="ابحث باسم المجموعة أو الكود..."
                emptyText="لا توجد مجموعات مطابقة"
                clearable
                searchable
                disabled={isLoadingGroups || groups.length === 0}
                value={selectedGroupId}
                onChange={(e) => onSelectGroupId(e.target.value)}
                options={groupOptions}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-muted/20 px-3 py-2">
              <span className="text-xs font-bold text-foreground">الأولوية لرقم:</span>
              <div className="flex flex-wrap gap-1">
                {PHONE_PREF_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onChangePhonePreference(opt.value)}
                    className={`rounded-lg border px-2 py-1 text-[11px] font-bold transition-colors ${
                      phonePreference === opt.value
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {!selectedGroupId ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/15 px-4 py-8 text-center">
                <Users className="mx-auto mb-2 h-7 w-7 text-muted-foreground/60" />
                <p className="text-xs font-bold text-foreground">
                  اختر مجموعة لعرض قائمة طلابها وإرسال الرسائل
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  يمكنك تحديد طلاب المجموعة بالكامل أو اختيار طلاب محددين وإرسال رسائل متتالية لكل طالب في نافذة واتساب.
                </p>
              </div>
            ) : isLoadingGroupStudents ? (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-border py-8 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>جاري تحميل طلاب المجموعة...</span>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 min-w-[180px]">
                    <Input
                      value={groupSearch}
                      onChange={(e) => setGroupSearch(e.target.value)}
                      placeholder="ابحث بالاسم أو الكود أو الهاتف..."
                      className="pr-9"
                    />
                    <Search className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={onToggleAllGroupStudents}
                    disabled={groupMembers.length === 0}
                    className="gap-1.5"
                  >
                    {allGroupChecked ? (
                      <CheckSquare className="h-4 w-4 text-primary" />
                    ) : (
                      <Square className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span>{allGroupChecked ? 'إلغاء الكل' : 'تحديد الكل'}</span>
                  </Button>
                </div>

                {/* شريط التقدم والإرسال المتتابع */}
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="info">
                      المؤهل للإرسال: {sendableSelectedMembers.length}
                    </Badge>
                    <Badge variant="success">
                      تم الفتح: {sentCount} / {sendableSelectedMembers.length}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {sentCount > 0 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={onResetSentQueue}
                        className="h-8 gap-1 px-2 text-[11px]"
                      >
                        <RotateCcw className="h-3 w-3" />
                        تصفير
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      disabled={remainingToSendCount === 0 || !hasMessageContent}
                      onClick={onSendNextGroupMember}
                      className="h-8 gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 font-bold"
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span>فتح التالي في واتساب ({remainingToSendCount})</span>
                    </Button>
                  </div>
                </div>

                <div className="max-h-64 overflow-y-auto rounded-xl border border-border bg-card divide-y divide-border">
                  {filteredGroupMembers.length === 0 ? (
                    <div className="py-6 text-center text-xs text-muted-foreground">
                      لا يوجد طلاب مطابقون داخل هذه المجموعة حالياً
                    </div>
                  ) : (
                    filteredGroupMembers.map((member) => {
                      const checked = selectedIds.has(member.student.id);
                      const isSent = sentIds.has(member.student.id);
                      const isPreviewed = activePreviewStudentId === member.student.id;

                      return (
                        <div
                          key={member.student.id}
                          onClick={() => onPreviewStudent(member.student.id)}
                          className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-xs transition-colors ${
                            isPreviewed ? 'bg-primary/5' : 'hover:bg-muted/30'
                          }`}
                        >
                          <div
                            className="flex min-w-0 flex-1 items-center gap-2.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={!member.hasValidPhone}
                              onChange={() => onToggleStudent(member.student.id)}
                              aria-label={`تحديد ${member.student.fullName}`}
                              className="h-4 w-4 shrink-0 rounded border-border accent-primary disabled:opacity-40"
                            />
                            <div
                              className="min-w-0 flex-1"
                              onClick={() => onPreviewStudent(member.student.id)}
                            >
                              <span className="block truncate font-bold text-foreground">
                                {member.student.fullName}
                              </span>
                              <span className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                <span className="font-mono">{member.student.studentCode}</span>
                                <span>•</span>
                                <span dir="ltr" className="font-mono inline-flex items-center gap-0.5">
                                  <Phone className="h-2.5 w-2.5" />
                                  {member.hasValidPhone ? member.normalizedDisplay : 'لا يوجد رقم صالح'}
                                </span>
                              </span>
                            </div>
                          </div>

                          <div
                            className="flex shrink-0 items-center gap-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {isSent && (
                              <Badge variant="success" className="gap-0.5 text-[10px]">
                                <CheckCircle2 className="h-2.5 w-2.5" />
                                تم الفتح
                              </Badge>
                            )}
                            <Button
                              type="button"
                              size="sm"
                              variant={isSent ? 'outline' : 'secondary'}
                              disabled={!member.hasValidPhone || !hasMessageContent}
                              onClick={() => onSendGroupMember(member)}
                              aria-label={`إرسال إلى ${member.student.fullName}`}
                              className="h-7 gap-1 px-2 text-[11px] font-bold"
                            >
                              <Send className="h-3 w-3 text-emerald-600" />
                              إرسال
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
