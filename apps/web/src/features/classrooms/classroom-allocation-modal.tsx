import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle,
  Clock,
  Plus,
  Trash2,
  Users,
  XCircle,
} from 'lucide-react';
import {
  Badge,
  Button,
  Input,
  Modal,
  Select,
  useToast,
} from '@/design-system';
import { apiClient, extractErrorMessage } from '@/lib/api-client';
import { ARABIC_DAYS, formatTimeRangeAr } from '@/lib/formatters';
import { confirmAction } from '@/lib/alerts';
import { AllocatedGroupItem, ClassroomRow } from './classrooms.types';

interface ClassroomAllocationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classroom: ClassroomRow | null;
}

interface UnallocatedGroup {
  id: string;
  groupCode: string;
  name: string;
  subject: string;
  gradeLevel: string;
  teacherName: string;
  defaultClassroomId?: string | null;
  defaultClassroomName?: string | null;
  maxStudents: number;
  enrolledCount: number;
  scheduleSlots: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    classroomId?: string | null;
  }>;
}

export function ClassroomAllocationModal({
  open,
  onOpenChange,
  classroom,
}: ClassroomAllocationModalProps) {
  const queryClient = useQueryClient();
  const { notify } = useToast();

  const [selectedGroupId, setSelectedGroupId] = React.useState<string>('');
  const [draftSlots, setDraftSlots] = React.useState<
    Array<{ dayOfWeek: number; startTime: string; endTime: string }>
  >([]);
  const [updateUpcoming, setUpdateUpcoming] = React.useState<boolean>(true);
  const [allowOverCapacity, setAllowOverCapacity] = React.useState<boolean>(false);
  const [includeAll, setIncludeAll] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (!open) {
      setSelectedGroupId('');
      setDraftSlots([]);
      setAllowOverCapacity(false);
    }
  }, [open, classroom?.id]);

  // Fetch groups allocated to this classroom
  const {
    data: allocatedData,
    isLoading: isAllocatedLoading,
  } = useQuery<{ classroom: ClassroomRow; groups: AllocatedGroupItem[] }>({
    queryKey: ['classroom-allocated-groups', classroom?.id],
    enabled: Boolean(open && classroom?.id),
    queryFn: async () =>
      (await apiClient.get(`/classrooms/${classroom!.id}/allocated-groups`)).data,
  });

  // Fetch groups needing allocation (or all active groups if includeAll is true)
  const {
    data: unallocatedGroups,
  } = useQuery<UnallocatedGroup[]>({
    queryKey: ['classroom-unallocated-groups', includeAll],
    enabled: Boolean(open),
    queryFn: async () =>
      (
        await apiClient.get('/classrooms/unallocated-groups', {
          params: { includeAll: includeAll ? 'true' : 'false' },
        })
      ).data,
  });

  const allocatedGroups = allocatedData?.groups ?? [];
  const selectedGroup = React.useMemo(() => {
    const fromUnallocated = (unallocatedGroups ?? []).find((g) => g.id === selectedGroupId);
    if (fromUnallocated) return fromUnallocated;
    const fromAllocated = allocatedGroups.find((g) => g.id === selectedGroupId);
    if (!fromAllocated) return undefined;
    return {
      ...fromAllocated,
      defaultClassroomId: classroom?.id ?? null,
      defaultClassroomName: classroom?.name ?? null,
    } as UnallocatedGroup;
  }, [unallocatedGroups, allocatedGroups, selectedGroupId, classroom]);

  React.useEffect(() => {
    if (!selectedGroup || !classroom) {
      setDraftSlots([]);
      return;
    }
    const existingForThisRoom = (selectedGroup.scheduleSlots ?? []).filter(
      (s) => !s.classroomId || s.classroomId === classroom.id,
    );
    setDraftSlots(
      existingForThisRoom.map((s) => ({
        dayOfWeek: Number(s.dayOfWeek),
        startTime: s.startTime.slice(0, 5),
        endTime: s.endTime.slice(0, 5),
      })),
    );
  }, [selectedGroup?.id, classroom?.id]);

  // Check for validation errors & conflicts between draftSlots and current classroom schedule
  const conflictWarnings = React.useMemo(() => {
    if (!selectedGroup || !classroom) return [];
    const warnings: string[] = [];

    for (let i = 0; i < draftSlots.length; i++) {
      const slotA = draftSlots[i];
      if (!slotA.startTime || !slotA.endTime || slotA.startTime >= slotA.endTime) {
        const dayName = ARABIC_DAYS[slotA.dayOfWeek] ?? String(slotA.dayOfWeek);
        warnings.push(`موعد غير صالح يوم (${dayName}): وقت النهاية يجب أن يكون بعد وقت البداية`);
        continue;
      }

      for (let j = i + 1; j < draftSlots.length; j++) {
        const slotSelf = draftSlots[j];
        if (
          Number(slotA.dayOfWeek) === Number(slotSelf.dayOfWeek) &&
          slotA.startTime < slotSelf.endTime &&
          slotA.endTime > slotSelf.startTime
        ) {
          const dayName = ARABIC_DAYS[slotA.dayOfWeek] ?? String(slotA.dayOfWeek);
          warnings.push(`تعارض داخلي بين مواعيد المجموعة نفسها يوم (${dayName})`);
        }
      }

      for (const existingGroup of allocatedGroups) {
        if (existingGroup.id === selectedGroup.id) continue;
        for (const slotB of existingGroup.slotsForThisRoom ?? []) {
          const bStart = slotB.startTime.slice(0, 5);
          const bEnd = slotB.endTime.slice(0, 5);
          if (
            Number(slotA.dayOfWeek) === Number(slotB.dayOfWeek) &&
            slotA.startTime < bEnd &&
            slotA.endTime > bStart
          ) {
            const dayName = ARABIC_DAYS[slotA.dayOfWeek] ?? String(slotA.dayOfWeek);
            warnings.push(
              `تعارض مع "${existingGroup.name}" يوم (${dayName}) (${formatTimeRangeAr(bStart, bEnd)})`,
            );
          }
        }
      }
    }
    return warnings;
  }, [selectedGroup, classroom, allocatedGroups, draftSlots]);

  // Check for capacity warning
  const isOverCapacity = React.useMemo(() => {
    if (!selectedGroup || !classroom) return false;
    return (
      selectedGroup.enrolledCount > classroom.maxCapacity ||
      selectedGroup.maxStudents > classroom.maxCapacity
    );
  }, [selectedGroup, classroom]);

  // Allocation mutation
  const allocateMutation = useMutation({
    mutationFn: async () => {
      if (!classroom || !selectedGroup) return;
      const otherRoomSlots = (selectedGroup.scheduleSlots ?? [])
        .filter((s) => s.classroomId && s.classroomId !== classroom.id)
        .map((s) => ({
          dayOfWeek: Number(s.dayOfWeek),
          startTime: s.startTime.slice(0, 5),
          endTime: s.endTime.slice(0, 5),
          classroomId: s.classroomId ?? null,
        }));
      const mergedSlots = [
        ...otherRoomSlots,
        ...draftSlots.map((s) => ({
          dayOfWeek: Number(s.dayOfWeek),
          startTime: s.startTime.slice(0, 5),
          endTime: s.endTime.slice(0, 5),
          classroomId: classroom.id,
        })),
      ];
      return apiClient.post(`/classrooms/${classroom.id}/allocate-group`, {
        groupId: selectedGroup.id,
        slots: mergedSlots,
        updateUpcomingSessions: updateUpcoming,
        allowOverCapacity: isOverCapacity ? allowOverCapacity : undefined,
      });
    },
    onSuccess: () => {
      notify('تم تسكين المجموعة وتنظيم مواعيدها في القاعة بنجاح', 'success');
      setSelectedGroupId('');
      setDraftSlots([]);
      queryClient.invalidateQueries({ queryKey: ['classroom-allocated-groups'] });
      queryClient.invalidateQueries({ queryKey: ['classroom-unallocated-groups'] });
      queryClient.invalidateQueries({ queryKey: ['classroom-schedule'] });
      queryClient.invalidateQueries({ queryKey: ['classrooms'] });
      queryClient.invalidateQueries({ queryKey: ['classrooms-available'] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['group-detail'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['groups-lookups'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
    },
    onError: (err) => notify(extractErrorMessage(err), 'error'),
  });

  // Release mutation
  const releaseMutation = useMutation({
    mutationFn: async (groupId: string) => {
      if (!classroom) {
        throw new Error('لم يتم تحديد القاعة');
      }
      return apiClient.delete(`/classrooms/${classroom.id}/allocate-group/${groupId}`);
    },
    onSuccess: (_data, releasedGroupId) => {
      notify('تم تحرير القاعة وإلغاء تسكين المجموعة بنجاح', 'success');
      if (selectedGroupId === releasedGroupId) {
        setSelectedGroupId('');
        setDraftSlots([]);
      }
      queryClient.invalidateQueries({ queryKey: ['classroom-allocated-groups'] });
      queryClient.invalidateQueries({ queryKey: ['classroom-unallocated-groups'] });
      queryClient.invalidateQueries({ queryKey: ['classroom-schedule'] });
      queryClient.invalidateQueries({ queryKey: ['classrooms'] });
      queryClient.invalidateQueries({ queryKey: ['classrooms-available'] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['group-detail'] });
      queryClient.invalidateQueries({ queryKey: ['groups-lookups'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
    },
    onError: (err) => notify(extractErrorMessage(err), 'error'),
  });

  if (!classroom) return null;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      title={`تسكين وتنظيم المجموعات: ${classroom.name} (قاعة #${classroom.roomNumber})`}
      description="إدارة تسكين المجموعات الدراسية، فحص التعارض الزمني، ومراقبة سعة القاعة"
    >
      <div className="space-y-6">
        {/* Room Header Info */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 p-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-foreground">{classroom.name}</span>
                <span className="font-mono text-xs text-muted-foreground">#{classroom.roomNumber}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                السعة القصوى: <strong className="text-foreground">{classroom.maxCapacity} طالب</strong> • المقاعد: {classroom.seatsCount}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="neutral">
              المجموعات المسكنة: {allocatedGroups.length}
            </Badge>
          </div>
        </div>

        {/* Section 1: Currently Allocated Groups */}
        <div className="space-y-3">
          <h4 className="flex items-center gap-1.5 text-sm font-bold text-foreground">
            <Users className="h-4 w-4 text-primary" />
            المجموعات المسكنة بالقاعة ({allocatedGroups.length})
          </h4>

          {isAllocatedLoading ? (
            <div className="h-28 animate-pulse rounded-xl bg-muted/40" />
          ) : allocatedGroups.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              لا توجد مجموعات مسكنة في هذه القاعة حالياً. يمكنك تسكين مجموعة جديدة بالأسفل.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {allocatedGroups.map((group) => {
                const slots = group.slotsForThisRoom?.length
                  ? group.slotsForThisRoom
                  : group.scheduleSlots;
                const capacityRatio = Math.round(
                  (group.enrolledCount / classroom.maxCapacity) * 100,
                );

                return (
                  <div
                    key={group.id}
                    className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/40 sm:flex-row sm:items-center"
                  >
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-foreground">{group.name}</span>
                        <span className="rounded bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                          {group.groupCode}
                        </span>
                        <Badge variant="neutral" className="text-[11px]">
                          {group.subject} - {group.gradeLevel}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                        <span>المدرس: <strong className="text-foreground">{group.teacherName}</strong></span>
                        <span className="flex items-center gap-1">
                          الطلاب المسجلين:
                          <strong
                            className={
                              group.enrolledCount > classroom.maxCapacity
                                ? 'text-destructive font-bold'
                                : 'text-foreground'
                            }
                          >
                            {group.enrolledCount} / {classroom.maxCapacity}
                          </strong>
                          {group.enrolledCount > classroom.maxCapacity && (
                            <Badge variant="danger" className="text-[10px] py-0 px-1">
                              تجاوز السعة
                            </Badge>
                          )}
                        </span>
                      </div>

                      {/* Schedule slots */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {slots.length === 0 ? (
                          <span className="text-xs text-muted-foreground">لم تحدد مواعيد أسبوعية</span>
                        ) : (
                          slots.map((s, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary"
                            >
                              <Calendar className="h-3 w-3" />
                              {ARABIC_DAYS[s.dayOfWeek]}: {formatTimeRangeAr(s.startTime, s.endTime)}
                            </span>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 text-xs"
                        onClick={() => {
                          setIncludeAll(true);
                          setSelectedGroupId(group.id);
                          setAllowOverCapacity(group.enrolledCount > classroom.maxCapacity);
                        }}
                      >
                        <Clock className="h-3.5 w-3.5 text-primary" />
                        تنظيم المواعيد
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        className="gap-1 text-xs"
                        isLoading={releaseMutation.isPending}
                        onClick={async () => {
                          const confirmed = await confirmAction({
                            title: 'تحرير القاعة وإلغاء التسكين',
                            text: `هل أنت متأكد من تحرير القاعة وإلغاء تسكين المجموعة "${group.name}"؟`,
                            isDestructive: true,
                            confirmButtonText: 'نعم، تحرير القاعة',
                          });
                          if (confirmed) {
                            releaseMutation.mutate(group.id);
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        تحرير القاعة
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Section 2: Allocate a New Group to this Classroom */}
        <div className="rounded-xl border border-border bg-muted/10 p-4 space-y-4">
          <h4 className="flex items-center gap-1.5 text-sm font-bold text-foreground">
            <Plus className="h-4 w-4 text-primary" />
            تسكين وتنظيم مجموعة جديدة في هذه القاعة
          </h4>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground">
                اختر المجموعة لتسكينها في هذه القاعة:
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                <input
                  type="checkbox"
                  checked={includeAll}
                  onChange={(e) => {
                    setIncludeAll(e.target.checked);
                    setSelectedGroupId('');
                  }}
                  className="rounded border-border text-primary focus:ring-primary"
                />
                عرض جميع المجموعات (لإعادة التسكين والنقل بين القاعات)
              </label>
            </div>

            <Select
              searchable
              searchPlaceholder="ابحث باسم المجموعة أو الكود أو المدرس..."
              placeholder="اختر المجموعة المراد تنظيمها في القاعة..."
              value={selectedGroupId}
              onChange={(e) => {
                setSelectedGroupId(e.target.value);
                setAllowOverCapacity(false);
              }}
              options={(unallocatedGroups ?? []).map((g) => ({
                value: g.id,
                label: `${g.name} (${g.groupCode}) — ${g.teacherName} [${g.enrolledCount} طالب]${
                  g.defaultClassroomName
                    ? ` — [مسكنة حالياً في: ${g.defaultClassroomName}]`
                    : ' — [غير مسكنة]'
                }`,
              }))}
            />

            {selectedGroup && (
              <div className="rounded-lg border border-border/70 bg-card p-3.5 space-y-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-foreground">
                    تنظيم المواعيد الأسبوعية للمجموعة ({selectedGroup.name}) داخل هذه القاعة:
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">
                      الطلاب المسجلين: <strong className="text-foreground">{selectedGroup.enrolledCount}</strong> • الحد الأقصى: {selectedGroup.maxStudents}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 px-2.5 text-xs"
                      onClick={() =>
                        setDraftSlots((prev) => [
                          ...prev,
                          { dayOfWeek: 6, startTime: '16:00', endTime: '18:00' },
                        ])
                      }
                    >
                      <Plus className="h-3 w-3" />
                      إضافة موعد بالقاعة
                    </Button>
                  </div>
                </div>

                {draftSlots.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border bg-muted/20 p-3 text-center text-muted-foreground">
                    لم يتم تحديد مواعيد أسبوعية لهذه المجموعة في القاعة بعد — اضغط «إضافة موعد بالقاعة» لتحديد اليوم والوقت.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {draftSlots.map((slot, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-1 items-end gap-2 rounded-lg border border-border bg-muted/20 p-2.5 sm:grid-cols-4"
                      >
                        <Select
                          searchable
                          label="اليوم"
                          value={String(slot.dayOfWeek)}
                          onChange={(e) =>
                            setDraftSlots((prev) =>
                              prev.map((s, i) =>
                                i === idx ? { ...s, dayOfWeek: Number(e.target.value) } : s,
                              ),
                            )
                          }
                          options={ARABIC_DAYS.map((d, di) => ({ value: String(di), label: d }))}
                        />
                        <Input
                          label="من الساعة"
                          type="time"
                          value={slot.startTime}
                          onChange={(e) =>
                            setDraftSlots((prev) =>
                              prev.map((s, i) =>
                                i === idx ? { ...s, startTime: e.target.value } : s,
                              ),
                            )
                          }
                        />
                        <Input
                          label="إلى الساعة"
                          type="time"
                          value={slot.endTime}
                          onChange={(e) =>
                            setDraftSlots((prev) =>
                              prev.map((s, i) =>
                                i === idx ? { ...s, endTime: e.target.value } : s,
                              ),
                            )
                          }
                        />
                        <Button
                          type="button"
                          variant="danger"
                          size="sm"
                          className="h-10"
                          onClick={() =>
                            setDraftSlots((prev) => prev.filter((_, i) => i !== idx))
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          حذف الموعد
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Conflict Warnings */}
                {conflictWarnings.length > 0 && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-destructive space-y-1">
                    <div className="flex items-center gap-1.5 font-bold">
                      <XCircle className="h-4 w-4" />
                      تعارض زمني مباشر في جدول القاعة:
                    </div>
                    {conflictWarnings.map((w, idx) => (
                      <p key={idx} className="mr-5 text-xs">{w}</p>
                    ))}
                  </div>
                )}

                {/* Capacity Warning */}
                {isOverCapacity && (
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-amber-700 dark:text-amber-400 space-y-2">
                    <div className="flex items-center gap-1.5 font-bold">
                      <AlertTriangle className="h-4 w-4" />
                      تحذير السعة: عدد طلاب المجموعة ({selectedGroup.enrolledCount} مسجل / {selectedGroup.maxStudents} أقصى) يتجاوز سعة القاعة ({classroom.maxCapacity} مقعد).
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer font-medium text-foreground">
                      <input
                        type="checkbox"
                        checked={allowOverCapacity}
                        onChange={(e) => setAllowOverCapacity(e.target.checked)}
                        className="rounded border-border text-primary focus:ring-primary"
                      />
                      موافقة الإدارة على تجاوز السعة وتسكين المجموعة رغم ذلك
                    </label>
                  </div>
                )}

                <div className="pt-1">
                  <label className="flex items-center gap-2 text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={updateUpcoming}
                      onChange={(e) => setUpdateUpcoming(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary"
                    />
                    تحديث القاعة تلقائياً في جميع الحصص الدراسية القادمة لهذه المجموعة
                  </label>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button
                type="button"
                disabled={
                  !selectedGroupId ||
                  conflictWarnings.length > 0 ||
                  (isOverCapacity && !allowOverCapacity)
                }
                isLoading={allocateMutation.isPending}
                onClick={() => allocateMutation.mutate()}
                className="gap-1.5"
              >
                <CheckCircle className="h-4 w-4" />
                تأكيد تسكين المجموعة في القاعة
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
