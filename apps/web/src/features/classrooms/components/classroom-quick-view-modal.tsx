import {
  CalendarRange,
  CheckCircle2,
  Cpu,
  Edit3,
  Layers,
  MapPin,
  Users,
  Wrench,
} from 'lucide-react';
import { PERMISSIONS } from '@edu-center/shared';
import { Badge, Button, Modal } from '@/design-system';
import { useAuth } from '@/features/auth/auth-context';
import { formatDateAr } from '@/lib/formatters';
import { CLASSROOM_STATUS_META, ClassroomRow } from '../classrooms.types';

interface ClassroomQuickViewModalProps {
  classroom: ClassroomRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (classroom: ClassroomRow) => void;
  onOpenSchedule: (classroom: ClassroomRow) => void;
  onOpenMaintenance: (classroom: ClassroomRow) => void;
}

export function ClassroomQuickViewModal({
  classroom,
  open,
  onOpenChange,
  onEdit,
  onOpenSchedule,
  onOpenMaintenance,
}: ClassroomQuickViewModalProps) {
  const { hasPermission } = useAuth();
  const canManageClassrooms = hasPermission(PERMISSIONS.CLASSROOMS_MANAGE);

  if (!classroom) return null;

  const statusMeta = CLASSROOM_STATUS_META[classroom.status] ?? {
    label: classroom.status,
    variant: 'neutral' as const,
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="بطاقة تفاصيل القاعة الدراسية"
      description="نظرة سريعة شاملة على سعة القاعة، التجهيزات التقنية، جدول الإشغال والصيانة"
      size="md"
    >
      <div className="space-y-4">
        {/* ترويسة القاعة */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 rounded-xl border border-border bg-muted/30 p-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-primary/10 px-2.5 py-0.5 font-mono text-xs font-bold text-primary">
                قاعة #{classroom.roomNumber}
              </span>
              <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
            </div>
            <h3 className="text-xl font-black text-foreground">{classroom.name}</h3>
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <CalendarRange className="h-3.5 w-3.5 text-primary" />
              تاريخ التسجيل: {formatDateAr(classroom.createdAt)}
            </p>
          </div>

          {canManageClassrooms && (
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  onEdit(classroom);
                }}
                className="gap-1 text-xs"
              >
                <Edit3 className="h-3.5 w-3.5" />
                تعديل
              </Button>
            </div>
          )}
        </div>

        {/* السعة والمقاعد */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border bg-card p-3.5">
            <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-primary" />
              السعة القصوى
            </span>
            <p className="mt-1 text-lg font-black text-foreground">
              {classroom.maxCapacity} <span className="text-xs font-normal text-muted-foreground">طالب</span>
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-3.5">
            <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-purple-600" />
              عدد المقاعد الفعلية
            </span>
            <p className="mt-1 text-lg font-black text-foreground">
              {classroom.seatsCount} <span className="text-xs font-normal text-muted-foreground">مقعد</span>
            </p>
          </div>
        </div>

        {/* التجهيزات والأجهزة */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-2.5">
          <h4 className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
            <Cpu className="h-3.5 w-3.5 text-primary" />
            التجهيزات والوسائل التعليمية المتوفرة
          </h4>
          {classroom.equipment && classroom.equipment.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {classroom.equipment.map((eq, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 rounded-md bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground"
                >
                  <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
                  {eq}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">لا توجد تجهيزات مخصصة مسجلة لهذه القاعة</p>
          )}
        </div>

        {/* الملاحظات إن وجدت */}
        {classroom.notes && (
          <div className="rounded-xl border border-border bg-card p-3 text-xs">
            <span className="font-bold text-muted-foreground block mb-1">ملاحظات القاعة:</span>
            <p className="text-foreground leading-relaxed whitespace-pre-wrap">{classroom.notes}</p>
          </div>
        )}

        {/* إجراءات سريعة */}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              onOpenSchedule(classroom);
            }}
            className="w-full justify-center gap-1.5"
          >
            <CalendarRange className="h-4 w-4 text-primary" />
            عرض الجدول الزمني
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              onOpenMaintenance(classroom);
            }}
            className="w-full justify-center gap-1.5"
          >
            <Wrench className="h-4 w-4 text-amber-500" />
            سجل الصيانة ({classroom.upcomingMaintenancesCount ?? 0})
          </Button>
        </div>
      </div>
    </Modal>
  );
}
