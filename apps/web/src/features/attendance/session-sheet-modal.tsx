import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCheck, Printer, Save, Search } from 'lucide-react';
import { AttendanceStatus, PERMISSIONS } from '@edu-center/shared';
import { Badge, Button, Input, Modal, useToast } from '@/design-system';
import { useAuth } from '@/features/auth/auth-context';
import { useCenterSettings } from '@/features/settings/center-settings-context';
import { apiClient, extractErrorMessage } from '@/lib/api-client';
import { formatDateAr, formatTimeRangeAr } from '@/lib/formatters';
import { printAttendanceSheetA4 } from '@/lib/print-service';
import { SessionSheetResponse } from './attendance.types';
import { SessionSheetRow } from './session-sheet-row';

interface SessionSheetModalProps {
  sessionId: string | null;
  onClose: () => void;
}

export function SessionSheetModal({ sessionId, onClose }: SessionSheetModalProps) {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const { hasPermission } = useAuth();
  const { settings } = useCenterSettings();

  const canRecord = hasPermission(PERMISSIONS.ATTENDANCE_RECORD);
  const canOverride = hasPermission(PERMISSIONS.ATTENDANCE_OVERRIDE);

  const [search, setSearch] = React.useState('');
  const [topic, setTopic] = React.useState('');
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<
    Record<string, { status: AttendanceStatus; notes: string }>
  >({});

  const { data, isLoading } = useQuery<SessionSheetResponse>({
    queryKey: ['session-sheet', sessionId],
    enabled: Boolean(sessionId),
    queryFn: async () => (await apiClient.get(`/attendance/sessions/${sessionId}/sheet`)).data,
  });

  const isMonthClosed = Boolean(data?.isMonthClosed);
  const isSheetEditable = canRecord && !isMonthClosed;

  React.useEffect(() => {
    setSaveError(null);
    if (!data) return;
    setTopic(data.session.topic ?? '');
    const initial: Record<string, { status: AttendanceStatus; notes: string }> = {};
    for (const s of data.students) {
      if (s.status) {
        initial[s.studentId] = { status: s.status, notes: s.notes ?? '' };
      }
    }
    setDraft(initial);
  }, [data, sessionId]);

  const markAllPresent = () => {
    if (!data || !isSheetEditable) return;
    setDraft((prev) => {
      const next = { ...prev };
      for (const s of data.students) {
        const isLocked = Boolean(s.attendanceId) && !canOverride;
        if (!isLocked) {
          next[s.studentId] = {
            status: AttendanceStatus.PRESENT,
            notes: prev[s.studentId]?.notes ?? '',
          };
        }
      }
      return next;
    });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isMonthClosed) {
        throw new Error(
          `الشهر المالي (${data?.session.yearMonth}) مغلق نهائياً ولا يمكن حفظ أو تعديل الحضور فيه.`,
        );
      }
      const records = Object.entries(draft).map(([studentId, val]) => ({
        studentId,
        status: val.status,
        notes: val.notes.trim(),
      }));
      return apiClient.post(`/attendance/sessions/${sessionId}/record`, {
        topic: topic.trim(),
        records,
      });
    },
    onMutate: () => setSaveError(null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session-sheet', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['attendance-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['finance'] });
      queryClient.invalidateQueries({ queryKey: ['student-profile'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      notify('تم حفظ كشف الحضور بنجاح وتحديث حالة الحصة', 'success');
      onClose();
    },
    onError: (err) => {
      const msg = extractErrorMessage(err);
      setSaveError(msg);
      notify(msg, 'error');
    },
  });

  const filteredStudents = React.useMemo(() => {
    const list = data?.students ?? [];
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter(
      (s) =>
        s.studentName.toLowerCase().includes(q) ||
        s.studentCode.toLowerCase().includes(q) ||
        s.studentPhone.includes(q),
    );
  }, [data?.students, search]);

  const liveCounts = React.useMemo(() => {
    const vals = Object.values(draft);
    return {
      present: vals.filter((v) => v.status === AttendanceStatus.PRESENT).length,
      absent: vals.filter((v) => v.status === AttendanceStatus.ABSENT).length,
      excused: vals.filter((v) => v.status === AttendanceStatus.EXCUSED).length,
    };
  }, [draft]);

  return (
    <Modal
      open={Boolean(sessionId)}
      onOpenChange={(open) => !open && onClose()}
      size="xl"
      title={
        data
          ? `كشف حضور المجموعة: ${data.session.groupName} (${data.session.groupCode})`
          : 'كشف حضور الحصة'
      }
      description={
        data
          ? `${formatDateAr(data.session.sessionDate)} | ${formatTimeRangeAr(data.session.startTime, data.session.endTime)} | المدرس: ${data.session.teacherName}`
          : undefined
      }
    >
      {isLoading || !data ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          جاري تحميل كشف الطلاب المسجلين...
        </div>
      ) : (
        <div className="space-y-4">
          {isMonthClosed && (
            <div
              role="alert"
              className="rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs font-semibold text-amber-800 dark:border-amber-800/70 dark:bg-amber-950/40 dark:text-amber-300"
            >
              الشهر المالي ({data.session.yearMonth}) مغلق نهائياً — العرض للقراءة فقط ولا يمكن حفظ أو تعديل الحضور.
            </div>
          )}

          {saveError && (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
            >
              {saveError}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-muted/30 p-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="neutral">إجمالي المقيدين بتاريخ الحصة: {data.students.length}</Badge>
              <Badge variant="success">حاضر: {liveCounts.present}</Badge>
              <Badge variant="danger">غائب: {liveCounts.absent}</Badge>
              <Badge variant="warning">بعذر: {liveCounts.excused}</Badge>
            </div>
            {isSheetEditable && (
              <Button type="button" size="sm" variant="secondary" onClick={markAllPresent}>
                <CheckCheck className="h-4 w-4" />
                تحضير الكل
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="relative">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث باسم الطالب أو الكود أو الهاتف..."
                className="h-10 w-full rounded-lg border border-input bg-card pr-9 pl-3 text-sm"
              />
            </div>
            <Input
              placeholder="عنوان الدرس المشروح في هذه الحصة..."
              disabled={!isSheetEditable}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </div>

          <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-border">
            {filteredStudents.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                لا يوجد طلاب مقيدون في هذه المجموعة بتاريخ الحصة المحدد.
              </div>
            ) : (
              <table className="w-full border-collapse text-right text-sm">
                <thead className="sticky top-0 bg-muted/90 text-xs font-bold text-muted-foreground backdrop-blur">
                  <tr className="border-b border-border">
                    <th className="px-3 py-2.5">الطالب</th>
                    <th className="px-3 py-2.5">حالة الحضور السريعة</th>
                    <th className="px-3 py-2.5">ملاحظة / سجل الرصد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredStudents.map((st) => (
                    <SessionSheetRow
                      key={st.studentId}
                      student={st}
                      current={draft[st.studentId]}
                      canRecord={isSheetEditable}
                      canOverride={canOverride}
                      onStatusChange={(status) =>
                        setDraft((prev) => ({
                          ...prev,
                          [st.studentId]: { status, notes: prev[st.studentId]?.notes ?? '' },
                        }))
                      }
                      onNotesChange={(notes) =>
                        setDraft((prev) => ({
                          ...prev,
                          [st.studentId]: {
                            status: prev[st.studentId]?.status ?? AttendanceStatus.PRESENT,
                            notes,
                          },
                        }))
                      }
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-border pt-3">
            <span className="text-xs text-muted-foreground">
              تم تحديد حالة {Object.keys(draft).length} من أصل {data.students.length} طالب
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="gap-1.5"
                onClick={() => {
                  if (!data) return;
                  printAttendanceSheetA4({
                    session: {
                      groupName: data.session.groupName,
                      teacherName: data.session.teacherName,
                      classroomName: data.session.classroomName,
                      sessionDate: data.session.sessionDate,
                      startTime: data.session.startTime,
                      endTime: data.session.endTime,
                      topic: topic || data.session.topic,
                    },
                    students: data.students.map((st) => ({
                      studentCode: st.studentCode,
                      studentName: st.studentName,
                      phone: st.studentPhone,
                      parentPhone: st.guardianPhone,
                      status: draft[st.studentId]?.status || st.status,
                      notes: draft[st.studentId]?.notes || st.notes,
                    })),
                    settings,
                  });
                }}
              >
                <Printer className="h-4 w-4 text-muted-foreground" />
                <span>طباعة الكشف (A4)</span>
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                إغلاق
              </Button>
              {canRecord && (
                <Button
                  type="button"
                  disabled={Object.keys(draft).length === 0 || isMonthClosed}
                  isLoading={saveMutation.isPending}
                  onClick={() => saveMutation.mutate()}
                >
                  <Save className="h-4 w-4" />
                  {isMonthClosed ? 'الشهر مغلق' : 'حفظ كشف الحضور'}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
