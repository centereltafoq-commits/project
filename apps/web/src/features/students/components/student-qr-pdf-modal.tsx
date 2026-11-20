import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CheckSquare,
  FileDown,
  Loader2,
  QrCode,
  Search,
  Square,
  Users,
} from 'lucide-react';
import { PaginatedResult, StudentStatus } from '@edu-center/shared';
import { Badge, Button, Input, Modal, Select, useToast } from '@/design-system';
import { useGradeLevels } from '@/features/grade-levels/use-grade-levels';
import { GroupRow } from '@/features/groups/groups.types';
import { apiClient, extractErrorMessage } from '@/lib/api-client';
import {
  generateStudentsQrPdf,
  QR_PDF_GRID_PRESETS,
  QrPdfGridPreset,
} from '@/lib/pdf/student-qr-pdf.generator';
import { StudentRow } from '../students.types';

interface StudentQrPdfModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialGradeFilter?: string;
  initialGroupId?: string;
}

const PRESET_OPTIONS: Array<{ value: QrPdfGridPreset; label: string }> = [
  { value: 'compact-20', label: 'موفر جداً — 20 كارت في ورقة A4 (4 × 5)' },
  { value: 'eco-24', label: 'أقصى توفير — 24 كارت في ورقة A4 (4 × 6)' },
  { value: 'medium-12', label: 'كبير وواضح — 12 كارت في ورقة A4 (3 × 4)' },
];

const EMPTY_GROUPS: GroupRow[] = [];
const EMPTY_STUDENTS: StudentRow[] = [];

export function StudentQrPdfModal({
  open,
  onOpenChange,
  initialGradeFilter = '',
  initialGroupId = '',
}: StudentQrPdfModalProps) {
  const { notify } = useToast();
  const { options: gradeOptions } = useGradeLevels(false);

  const [gradeFilter, setGradeFilter] = React.useState(initialGradeFilter);
  const [groupFilter, setGroupFilter] = React.useState(initialGroupId);
  const [activeOnly, setActiveOnly] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [preset, setPreset] = React.useState<QrPdfGridPreset>('compact-20');
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setGradeFilter(initialGradeFilter);
      setGroupFilter(initialGroupId);
      setSearchTerm('');
      setSelectedIds((prev) => (prev.size === 0 ? prev : new Set()));
    }
  }, [open, initialGradeFilter, initialGroupId]);

  const {
    data: groups = EMPTY_GROUPS,
    isLoading: isLoadingGroups,
    isError: isGroupsError,
    error: groupsError,
  } = useQuery<GroupRow[]>({
    queryKey: ['groups-qr-pdf-list'],
    enabled: open,
    queryFn: async () => {
      const collected: GroupRow[] = [];
      let currentPage = 1;
      let totalPages = 1;

      while (currentPage <= totalPages && currentPage <= 25) {
        const res = await apiClient.get<PaginatedResult<GroupRow>>('/groups', {
          params: {
            page: currentPage,
            limit: 100,
            isActive: 'true',
          },
        });
        collected.push(...(res.data.data ?? []));
        totalPages = res.data.meta?.totalPages ?? 1;
        currentPage += 1;
      }

      return collected;
    },
  });

  const mergedGradeOptions = React.useMemo(() => {
    const map = new Map(gradeOptions.map((opt) => [opt.value, opt]));
    for (const group of groups) {
      if (group.gradeLevel && !map.has(group.gradeLevel)) {
        map.set(group.gradeLevel, { value: group.gradeLevel, label: group.gradeLevel });
      }
    }
    return Array.from(map.values());
  }, [gradeOptions, groups]);

  const filteredGroups = React.useMemo(() => {
    if (!gradeFilter) return groups;
    return groups.filter((group) => group.gradeLevel === gradeFilter);
  }, [groups, gradeFilter]);

  const selectedGroup = React.useMemo(
    () => groups.find((group) => group.id === groupFilter) ?? null,
    [groups, groupFilter],
  );

  const groupOptions = React.useMemo(
    () =>
      filteredGroups.map((group) => ({
        value: group.id,
        label: `${group.name} (${group.groupCode})`,
        sublabel: `${group.gradeLevel} • ${group.subject} • ${group.activeStudentsCount} طالب`,
      })),
    [filteredGroups],
  );

  const handleGradeChange = (nextGrade: string) => {
    setGradeFilter(nextGrade);
    if (groupFilter && nextGrade && selectedGroup && selectedGroup.gradeLevel !== nextGrade) {
      setGroupFilter('');
      setSearchTerm('');
      setSelectedIds(new Set());
    }
  };

  React.useEffect(() => {
    if (
      open &&
      !isLoadingGroups &&
      groupFilter &&
      gradeFilter &&
      !filteredGroups.some((group) => group.id === groupFilter)
    ) {
      setGroupFilter('');
    }
  }, [open, isLoadingGroups, groupFilter, gradeFilter, filteredGroups]);

  const handleGroupChange = (nextGroupId: string) => {
    setGroupFilter(nextGroupId);
    setSearchTerm('');
  };

  const { data: allStudents = EMPTY_STUDENTS, isLoading } = useQuery<StudentRow[]>({
    queryKey: ['students-qr-pdf-list', groupFilter, activeOnly],
    enabled: open && Boolean(groupFilter),
    queryFn: async () => {
      const collected: StudentRow[] = [];
      let currentPage = 1;
      let totalPages = 1;

      while (currentPage <= totalPages && currentPage <= 25) {
        const res = await apiClient.get<PaginatedResult<StudentRow>>('/students', {
          params: {
            page: currentPage,
            limit: 100,
            groupId: groupFilter,
            status: activeOnly ? StudentStatus.ACTIVE : undefined,
          },
        });
        collected.push(...(res.data.data ?? []));
        totalPages = res.data.meta?.totalPages ?? 1;
        currentPage += 1;
      }

      return collected;
    },
  });

  const filteredStudents = React.useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return allStudents;
    return allStudents.filter(
      (s) =>
        s.fullName.toLowerCase().includes(term) ||
        s.studentCode.toLowerCase().includes(term),
    );
  }, [allStudents, searchTerm]);

  // Auto-select loaded group students whenever selection results refresh
  React.useEffect(() => {
    if (!open || !groupFilter) {
      setSelectedIds((prev) => (prev.size === 0 ? prev : new Set()));
      return;
    }
    setSelectedIds(new Set(allStudents.map((s) => s.id)));
  }, [open, groupFilter, allStudents]);

  const selectedStudents = React.useMemo(
    () => filteredStudents.filter((s) => selectedIds.has(s.id)),
    [filteredStudents, selectedIds],
  );

  const allChecked =
    filteredStudents.length > 0 && selectedStudents.length === filteredStudents.length;

  const toggleAll = () => {
    if (!groupFilter) return;
    if (allChecked) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredStudents.map((s) => s.id)));
    }
  };

  const toggleStudent = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const gridConfig = QR_PDF_GRID_PRESETS[preset];
  const estimatedPages = Math.max(
    1,
    Math.ceil(selectedStudents.length / (gridConfig.cols * gridConfig.rows)),
  );

  const handleGeneratePdf = async () => {
    if (!groupFilter) {
      notify('يرجى اختيار مجموعة معينة أولاً قبل توليد ملف PDF', 'error');
      return;
    }
    if (selectedStudents.length === 0) {
      notify('يرجى تحديد طالب واحد على الأقل لتوليد ملف PDF', 'error');
      return;
    }

    setIsGenerating(true);
    try {
      const safeGroupCode = selectedGroup?.groupCode
        ?.replace(/[^A-Za-z0-9_-]/g, '')
        .trim();
      const todayIso = new Date().toISOString().slice(0, 10);

      const result = await generateStudentsQrPdf({
        students: selectedStudents.map((s) => ({
          id: s.id,
          studentCode: s.studentCode,
          fullName: s.fullName,
          gradeLevel: s.gradeLevel,
        })),
        preset,
        title: 'STUDENT QR PASS CARDS',
        subtitle: safeGroupCode ? `Group: ${safeGroupCode}` : undefined,
        filename: safeGroupCode
          ? `student-qr-codes-${safeGroupCode}-${todayIso}.pdf`
          : undefined,
      });
      notify(
        `تم توليد وتحميل ملف PDF (${result.fileName}) لعدد ${selectedStudents.length} طالب بنجاح`,
        'success',
      );
      onOpenChange(false);
    } catch (err) {
      notify(extractErrorMessage(err), 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const groupPlaceholder = isLoadingGroups
    ? 'جاري تحميل المجموعات...'
    : filteredGroups.length === 0
      ? 'لا توجد مجموعات متاحة لهذا الصف'
      : 'اختر المجموعة...';

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="تصدير وطباعة كروت QR للطلاب (PDF A4)"
      description="توليد ملف A4 منسّق بالإنجليزية لطباعة كروت QR لطلاب مجموعة محددة (مع إمكانية تصفية المجموعات حسب السنة الدراسية)"
    >
      <div className="space-y-4">
        {/* إعدادات السنة والمجموعة والتخطيط */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            label="تصفية حسب الصف الدراسي (اختياري)"
            placeholder="كل الصفوف الدراسية"
            clearable
            searchable
            value={gradeFilter}
            onChange={(e) => handleGradeChange(e.target.value)}
            options={mergedGradeOptions}
          />
          <Select
            label="المجموعة (مطلوب)"
            placeholder={groupPlaceholder}
            searchPlaceholder="ابحث باسم المجموعة أو الكود أو المادة..."
            emptyText="لا توجد مجموعات مطابقة"
            clearable
            searchable
            required
            disabled={isLoadingGroups || filteredGroups.length === 0}
            value={groupFilter}
            onChange={(e) => handleGroupChange(e.target.value)}
            options={groupOptions}
            error={isGroupsError ? extractErrorMessage(groupsError) : undefined}
          />
        </div>

        <div className="grid grid-cols-1">
          <Select
            label="توزيع الكروت في صفحة A4"
            value={preset}
            onChange={(e) => setPreset(e.target.value as QrPdfGridPreset)}
            options={PRESET_OPTIONS}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 px-3.5 py-2.5 text-xs">
          <label className="flex cursor-pointer items-center gap-2 font-semibold text-foreground select-none">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            <span>الطلاب النشطين فقط</span>
          </label>

          <div className="flex flex-wrap items-center gap-2">
            {selectedGroup && (
              <Badge variant="purple">
                المجموعة: {selectedGroup.name}
              </Badge>
            )}
            <Badge variant="info">
              المحدد: {selectedStudents.length} طالب
            </Badge>
            <Badge variant="neutral">
              عدد الصفحات: {selectedStudents.length > 0 ? estimatedPages : 0} A4
            </Badge>
          </div>
        </div>

        {/* شريط البحث واختيار الطلاب */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Input
                placeholder="ابحث باسم الطالب أو الكود..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={!groupFilter}
                className="pr-9"
              />
              <Search className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleAll}
              disabled={!groupFilter || filteredStudents.length === 0}
              className="gap-1.5"
            >
              {allChecked ? (
                <CheckSquare className="h-4 w-4 text-primary" />
              ) : (
                <Square className="h-4 w-4 text-muted-foreground" />
              )}
              <span>{allChecked ? 'إلغاء تحديد الكل' : 'تحديد الكل'}</span>
            </Button>
          </div>

          <div className="max-h-56 overflow-y-auto rounded-xl border border-border bg-card divide-y divide-border">
            {isGroupsError ? (
              <div className="px-4 py-8 text-center text-xs font-semibold text-destructive">
                {extractErrorMessage(groupsError)}
              </div>
            ) : !groupFilter ? (
              <div className="flex flex-col items-center justify-center gap-1.5 px-4 py-8 text-center">
                <Users className="h-6 w-6 text-muted-foreground/70" />
                <p className="text-xs font-bold text-foreground">
                  يرجى اختيار مجموعة معينة أولاً
                </p>
                <p className="text-[11px] text-muted-foreground max-w-md">
                  يمكنك تصفية المجموعات حسب الصف الدراسي بالأعلى، ثم اختيار المجموعة المطلوبة لعرض طلابها وطباعة كروت QR الخاصة بهم.
                </p>
              </div>
            ) : isLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>جاري تحميل طلاب المجموعة...</span>
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                لا يوجد طلاب مطابقون داخل هذه المجموعة حالياً
              </div>
            ) : (
              filteredStudents.map((student) => {
                const checked = selectedIds.has(student.id);
                return (
                  <label
                    key={student.id}
                    className="flex cursor-pointer items-center justify-between gap-3 px-3.5 py-2 text-xs hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleStudent(student.id)}
                        className="h-4 w-4 shrink-0 rounded border-border accent-primary"
                      />
                      <span className="font-bold text-foreground truncate">{student.fullName}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] text-muted-foreground">{student.gradeLevel}</span>
                      <span
                        dir="ltr"
                        className="rounded bg-primary/10 px-2 py-0.5 font-mono text-[11px] font-bold text-primary"
                      >
                        {student.studentCode}
                      </span>
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </div>

        {/* معاينة مصغرة لشكل الكارت */}
        <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-border bg-muted/15 px-4 py-2.5 text-xs">
          <div className="space-y-0.5">
            <span className="font-bold text-foreground block">
              شكل الكارت داخل ملف A4 PDF:
            </span>
            <span className="text-[11px] text-muted-foreground">
              اسم الطالب في الأعلى ← كود QR واضح في المنتصف ← كود الطالب بالإنجليزية بالأسفل (خلفية بيضاء لتوفير الحبر).
            </span>
          </div>
          <div className="shrink-0 rounded-lg border border-dashed border-slate-400 bg-white px-3 py-1.5 text-center text-slate-900 shadow-sm">
            <div className="text-[9px] font-bold leading-tight">اسم الطالب</div>
            <QrCode className="mx-auto my-0.5 h-6 w-6 text-slate-900" />
            <div className="font-mono text-[8px] font-bold text-slate-600">STU-2026-5001</div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button
            type="button"
            onClick={handleGeneratePdf}
            disabled={isGenerating || !groupFilter || selectedStudents.length === 0}
            className="gap-2 font-bold"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4" />
            )}
            <span>
              توليد وتحميل PDF ({selectedStudents.length})
            </span>
          </Button>
        </div>
      </div>
    </Modal>
  );
}
