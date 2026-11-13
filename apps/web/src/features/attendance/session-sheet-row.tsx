import { Lock } from 'lucide-react';
import { AttendanceStatus } from '@edu-center/shared';
import { cn } from '@/lib/cn';
import { SheetStudentRow } from './attendance.types';

const STATUS_BUTTONS: Array<{
  value: AttendanceStatus;
  label: string;
  activeClass: string;
}> = [
  {
    value: AttendanceStatus.PRESENT,
    label: 'حاضر',
    activeClass: 'bg-emerald-600 text-white border-emerald-600 shadow-sm',
  },
  {
    value: AttendanceStatus.ABSENT,
    label: 'غائب',
    activeClass: 'bg-rose-600 text-white border-rose-600 shadow-sm',
  },
  {
    value: AttendanceStatus.EXCUSED,
    label: 'بعذر',
    activeClass: 'bg-amber-500 text-white border-amber-500 shadow-sm',
  },
];

interface SessionSheetRowProps {
  student: SheetStudentRow;
  current?: { status: AttendanceStatus; notes: string };
  canRecord: boolean;
  canOverride: boolean;
  onStatusChange: (status: AttendanceStatus) => void;
  onNotesChange: (notes: string) => void;
}

export function SessionSheetRow({
  student,
  current,
  canRecord,
  canOverride,
  onStatusChange,
  onNotesChange,
}: SessionSheetRowProps) {
  const isLocked = Boolean(student.attendanceId) && !canOverride;

  return (
    <tr className="hover:bg-accent/30">
      <td className="px-3 py-2.5">
        <div className="font-bold text-foreground">{student.studentName}</div>
        <div className="text-xs text-muted-foreground">
          {student.studentCode} • ولي الأمر: {student.guardianPhone}
        </div>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_BUTTONS.map((btn) => {
            const active = current?.status === btn.value;
            return (
              <button
                key={btn.value}
                type="button"
                disabled={!canRecord || isLocked}
                onClick={() => onStatusChange(btn.value)}
                className={cn(
                  'rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50',
                  active
                    ? btn.activeClass
                    : 'border-border bg-card text-foreground hover:bg-accent',
                )}
              >
                {btn.label}
              </button>
            );
          })}
          {isLocked && (
            <span className="inline-flex items-center gap-1 text-[11px] text-amber-600">
              <Lock className="h-3 w-3" />
              يتطلب صلاحية تعديل إدارية
            </span>
          )}
        </div>
      </td>
      <td className="px-3 py-2.5">
        <input
          type="text"
          disabled={!canRecord || isLocked}
          placeholder="ملاحظة..."
          value={current?.notes ?? ''}
          onChange={(e) => onNotesChange(e.target.value)}
          className="h-8 w-full rounded border border-input bg-card px-2 text-xs"
        />
        {(student.recordedByName || student.updatedByName) && (
          <div className="mt-1 text-[11px] text-muted-foreground">
            {student.recordedByName && <span>رصد: {student.recordedByName}</span>}
            {student.updatedByName && <span> • تعديل: {student.updatedByName}</span>}
          </div>
        )}
      </td>
    </tr>
  );
}
