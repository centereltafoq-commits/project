import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CheckSquare,
  FileDown,
  Loader2,
  QrCode,
  Search,
  Square,
} from 'lucide-react';
import { PaginatedResult, StudentStatus } from '@edu-center/shared';
import { Badge, Button, Input, Modal, Select, useToast } from '@/design-system';
import { useGradeLevels } from '@/features/grade-levels/use-grade-levels';
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
}

const PRESET_OPTIONS: Array<{ value: QrPdfGridPreset; label: string }> = [
  { value: 'compact-20', label: 'موفر جداً — 20 كارت في ورقة A4 (4 × 5)' },
  { value: 'eco-24', label: 'أقصى توفير — 24 كارت في ورقة A4 (4 × 6)' },
  { value: 'medium-12', label: 'كبير وواضح — 12 كارت في ورقة A4 (3 × 4)' },
];

export function StudentQrPdfModal({
  open,
  onOpenChange,
  initialGradeFilter = '',
}: StudentQrPdfModalProps) {
  const { notify } = useToast();
  const { options: gradeOptions } = useGradeLevels(false);

  const [gradeFilter, setGradeFilter] = React.useState(initialGradeFilter);
  const [activeOnly, setActiveOnly] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [preset, setPreset] = React.useState<QrPdfGridPreset>('compact-20');
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setGradeFilter(initialGradeFilter);
      setSearchTerm('');
    }
  }, [open, initialGradeFilter]);

  const { data: allStudents = [], isLoading } = useQuery<StudentRow[]>({
    queryKey: ['students-qr-pdf-list', gradeFilter, activeOnly],
    enabled: open,
    queryFn: async () => {
      const collected: StudentRow[] = [];
      let currentPage = 1;
      let totalPages = 1;

      while (currentPage <= totalPages && currentPage <= 25) {
        const res = await apiClient.get<PaginatedResult<StudentRow>>('/students', {
          params: {
            page: currentPage,
            limit: 100,
            gradeLevel: gradeFilter || undefined,
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

  // Auto-select loaded students whenever filter results refresh
  React.useEffect(() => {
    if (!open) return;
    setSelectedIds(new Set(allStudents.map((s) => s.id)));
  }, [open, allStudents]);

  const selectedStudents = React.useMemo(
    () => filteredStudents.filter((s) => selectedIds.has(s.id)),
    [filteredStudents, selectedIds],
  );

  const allChecked =
    filteredStudents.length > 0 && selectedStudents.length === filteredStudents.length;

  const toggleAll = () => {
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
    if (selectedStudents.length === 0) {
      notify('يرجى تحديد طالب واحد على الأقل لتوليد ملف PDF', 'error');
      return;
    }

    setIsGenerating(true);
    try {
      const result = await generateStudentsQrPdf({
        students: selectedStudents.map((s) => ({
          id: s.id,
          studentCode: s.studentCode,
          fullName: s.fullName,
          gradeLevel: s.gradeLevel,
        })),
        preset,
        title: 'STUDENT QR PASS CARDS',
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

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="تصدير وطباعة كروت QR للطلاب (PDF A4)"
      description="توليد ملف A4 منسّق بالإنجليزية يحتوي على عدة كروت QR في نفس الصفحة لتوفير الورق والطباعة"
    >
      <div className="space-y-4">
        {/* إعدادات التخطيط والفلترة */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            label="توزيع الكروت في صفحة A4"
            value={preset}
            onChange={(e) => setPreset(e.target.value as QrPdfGridPreset)}
            options={PRESET_OPTIONS}
          />
          <Select
            label="تصفية حسب الصف الدراسي"
            placeholder="كل الصفوف الدراسية"
            clearable
            searchable
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            options={gradeOptions}
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
                className="pr-9"
              />
              <Search className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleAll}
              disabled={filteredStudents.length === 0}
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
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>جاري تحميل قائمة الطلاب...</span>
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                لا يوجد طلاب مطابقون للبحث أو الفلتر الحالي
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
            disabled={isGenerating || selectedStudents.length === 0}
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
