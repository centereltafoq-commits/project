import * as React from 'react';
import { Check, Search, Users, X } from 'lucide-react';
import { Badge, Button, Input } from '@/design-system';

export interface LookupStudentOption {
  id: string;
  studentCode: string;
  fullName: string;
  phone?: string | null;
  gradeLevel: string;
}

interface StudentMultiSelectListProps {
  students: LookupStudentOption[];
  selectedIds: string[];
  onChangeSelectedIds: (nextIds: string[]) => void;
  activeStudentIds: Set<string>;
  groupGradeLevel: string;
  remainingSeats: number;
  isLoading?: boolean;
}

export function StudentMultiSelectList({
  students,
  selectedIds,
  onChangeSelectedIds,
  activeStudentIds,
  groupGradeLevel,
  remainingSeats,
  isLoading = false,
}: StudentMultiSelectListProps) {
  const [search, setSearch] = React.useState('');
  const [onlyGroupGrade, setOnlyGroupGrade] = React.useState(false);

  const selectedSet = React.useMemo(() => new Set(selectedIds), [selectedIds]);
  const studentById = React.useMemo(
    () => new Map(students.map((s) => [s.id, s])),
    [students],
  );

  const filteredStudents = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      if (onlyGroupGrade && s.gradeLevel !== groupGradeLevel) {
        return false;
      }
      if (!q) return true;
      return (
        s.fullName.toLowerCase().includes(q) ||
        s.studentCode.toLowerCase().includes(q) ||
        (s.phone ?? '').toLowerCase().includes(q) ||
        s.gradeLevel.toLowerCase().includes(q)
      );
    });
  }, [groupGradeLevel, onlyGroupGrade, search, students]);

  const selectableVisible = React.useMemo(
    () => filteredStudents.filter((s) => !activeStudentIds.has(s.id)),
    [activeStudentIds, filteredStudents],
  );

  const toggleStudent = (studentId: string) => {
    if (activeStudentIds.has(studentId)) return;
    if (selectedSet.has(studentId)) {
      onChangeSelectedIds(selectedIds.filter((id) => id !== studentId));
    } else {
      onChangeSelectedIds([...selectedIds, studentId]);
    }
  };

  const handleSelectAllVisible = () => {
    const merged = new Set(selectedIds);
    for (const s of selectableVisible) {
      merged.add(s.id);
    }
    onChangeSelectedIds(Array.from(merged));
  };

  const exceedsCapacity = selectedIds.length > remainingSeats;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Input
            placeholder="ابحث باسم الطالب أو الكود أو رقم الهاتف..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="بحث في قائمة الطلاب"
          />
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant={onlyGroupGrade ? 'primary' : 'outline'}
            onClick={() => setOnlyGroupGrade((prev) => !prev)}
            className="h-9 text-xs"
          >
            نفس الصف ({groupGradeLevel})
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleSelectAllVisible}
            disabled={selectableVisible.length === 0}
            className="h-9 text-xs"
          >
            تحديد الظاهر ({selectableVisible.length})
          </Button>
          {selectedIds.length > 0 && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onChangeSelectedIds([])}
              className="h-9 text-xs text-muted-foreground hover:text-foreground"
            >
              مسح التحديد
            </Button>
          )}
        </div>
      </div>

      {/* Selected count & remaining capacity indicator */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs">
        <span className="flex items-center gap-1.5 font-bold text-foreground">
          <Users className="h-3.5 w-3.5 text-primary" />
          المختار الآن: {selectedIds.length} طالب
        </span>
        <span
          className={`font-bold ${
            exceedsCapacity ? 'text-destructive' : 'text-muted-foreground'
          }`}
        >
          المقاعد المتاحة بالمجموعة: {remainingSeats}
          {exceedsCapacity ? ' — العدد المختار يتجاوز السعة المتاحة!' : ''}
        </span>
      </div>

      {/* Selected chips */}
      {selectedIds.length > 0 && (
        <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-primary/20 bg-primary/5 p-2">
          {selectedIds.map((id) => {
            const st = studentById.get(id);
            if (!st) return null;
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 rounded-full bg-card px-2.5 py-0.5 text-[11px] font-semibold text-foreground shadow-sm border border-border"
              >
                <span>{st.fullName}</span>
                <span className="font-mono text-[10px] text-muted-foreground">({st.studentCode})</span>
                <button
                  type="button"
                  onClick={() => toggleStudent(id)}
                  aria-label={`إزالة ${st.fullName}`}
                  className="mr-0.5 rounded-full p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Checklist */}
      <div className="max-h-60 overflow-y-auto divide-y divide-border rounded-xl border border-border bg-card">
        {isLoading ? (
          <div className="p-6 text-center text-xs text-muted-foreground">
            جارٍ تحميل قائمة الطلاب...
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground">
            لا يوجد طلاب مطابقون للبحث الحالي
          </div>
        ) : (
          filteredStudents.map((student) => {
            const alreadyEnrolled = activeStudentIds.has(student.id);
            const isSelected = selectedSet.has(student.id);
            return (
              <label
                key={student.id}
                className={`flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs transition-colors ${
                  alreadyEnrolled
                    ? 'cursor-not-allowed bg-muted/30 opacity-65'
                    : isSelected
                      ? 'cursor-pointer bg-primary/5'
                      : 'cursor-pointer hover:bg-muted/40'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <input
                    type="checkbox"
                    disabled={alreadyEnrolled}
                    checked={alreadyEnrolled || isSelected}
                    onChange={() => toggleStudent(student.id)}
                    className="h-4 w-4 shrink-0 rounded border-border accent-primary"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 font-bold text-foreground truncate">
                      <span>{student.fullName}</span>
                      {isSelected && !alreadyEnrolled && (
                        <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className="font-mono">{student.studentCode}</span>
                      {student.phone && (
                        <>
                          <span>•</span>
                          <span className="font-mono" dir="ltr">
                            {student.phone}
                          </span>
                        </>
                      )}
                      <span>•</span>
                      <span>{student.gradeLevel}</span>
                    </div>
                  </div>
                </div>

                {alreadyEnrolled && (
                  <Badge variant="neutral" className="shrink-0 text-[10px]">
                    مشترك بالفعل
                  </Badge>
                )}
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}
