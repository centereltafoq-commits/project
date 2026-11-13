import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Edit3,
  ExternalLink,
  MessageCircle,
  Phone,
} from 'lucide-react';
import { PERMISSIONS } from '@edu-center/shared';
import { Badge, Button, Modal } from '@/design-system';
import { useAuth } from '@/features/auth/auth-context';
import { formatDateAr } from '@/lib/formatters';
import { TEACHER_STATUS_META, TeacherRow } from '../teachers.types';

interface TeacherQuickViewModalProps {
  teacher: TeacherRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (teacher: TeacherRow) => void;
}

export function TeacherQuickViewModal({
  teacher,
  open,
  onOpenChange,
  onEdit,
}: TeacherQuickViewModalProps) {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canManageTeachers = hasPermission(PERMISSIONS.TEACHERS_MANAGE);

  if (!teacher) return null;

  const statusMeta = TEACHER_STATUS_META[teacher.employmentStatus] ?? {
    label: teacher.employmentStatus,
    variant: 'neutral' as const,
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="بطاقة تفاصيل المدرس السريعة"
      description="نظرة فورية شاملة على بيانات التواصل والمجموعات والتعاقد"
      size="md"
    >
      <div className="space-y-4">
        {/* ترويسة بطاقة المدرس */}
        <div className="flex items-start justify-between gap-3 rounded-xl border border-border bg-muted/30 p-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-purple-500/10 px-2.5 py-0.5 font-mono text-xs font-bold text-purple-600 dark:text-purple-400">
                {teacher.teacherCode}
              </span>
              <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
            </div>
            <h3 className="text-lg font-black text-foreground">{teacher.fullName}</h3>
            <p className="text-xs font-bold text-primary">
              مدرس مادة: {teacher.specialization}
            </p>
          </div>
        </div>

        {/* بيانات التواصل */}
        <div className="rounded-xl border border-border bg-card p-3.5">
          <span className="text-xs font-bold text-muted-foreground block flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5 text-primary" />
            رقم هاتف المدرس
          </span>
          <p dir="ltr" className="mt-1 text-sm font-mono font-bold text-foreground text-right">
            {teacher.phone || 'غير مسجل'}
          </p>
          {teacher.phone && (
            <a
              href={`https://wa.me/2${teacher.phone.replace(/\D/g, '')}`}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:underline"
            >
              <MessageCircle className="h-3 w-3" />
              مراسلة المدرس عبر واتساب
            </a>
          )}
        </div>

        {/* المجموعات وتاريخ التعاقد */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-3.5">
            <span className="text-xs font-bold text-muted-foreground block flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5 text-blue-600" />
              المجموعات الدراسية المسندة
            </span>
            <p className="mt-1 text-sm font-extrabold text-foreground">
              {teacher.assignedGroupsCount ?? 0} مجموعة مسندة
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-3.5">
            <span className="text-xs font-bold text-muted-foreground block flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-amber-600" />
              تاريخ بداية التعاقد
            </span>
            <p className="mt-1 text-sm font-medium text-foreground">
              {formatDateAr(teacher.contractDate)}
            </p>
          </div>
        </div>

        {/* ملاحظات المدرس إن وجدت */}
        {teacher.notes && (
          <div className="rounded-xl border border-border bg-muted/20 p-3 text-xs">
            <span className="font-bold text-muted-foreground block mb-1">ملاحظات إدارية:</span>
            <p className="text-foreground">{teacher.notes}</p>
          </div>
        )}

        {/* أزرار الإجراءات في أسفل النافذة */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
          {canManageTeachers ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                onEdit(teacher);
              }}
              className="gap-1.5"
            >
              <Edit3 className="h-3.5 w-3.5" />
              تعديل البيانات
            </Button>
          ) : (
            <span />
          )}

          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              onOpenChange(false);
              navigate(`/teachers/${teacher.id}`);
            }}
            className="gap-1.5 font-bold"
          >
            الملف الشامل والمستحقات
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </Modal>
  );
}

